#!/usr/bin/env node
/**
 * upload-session.mjs — выгрузка сессии Claude Code (JSONL + summary.md + meta.json) в S3.
 *
 * Режимы:
 *   node tools/upload-session.mjs <ProjectID|_unscoped> --summary <path> [--session-id <UUID>] [--dry-run]
 *       — залить одну (только что закончившуюся) сессию.
 *   node tools/upload-session.mjs rebuild [--dry-run]
 *       — перегенерировать meta.json + pointer ВСЕХ сессий из их raw.jsonl каноническим
 *         парсером и пересобрать _index/all-sessions.jsonl с нуля (single source of truth).
 *         Чинит исторический дрейф схемы meta и потерянные строки индекса.
 *
 * По умолчанию берёт самый свежий .jsonl из ~/.claude/projects/<encoded-cwd>/ —
 * это и есть текущая (только что закончившаяся) сессия.
 *
 * Структура в S3 (bucket=seo):
 *   logs/claude-code/by-project/{ProjectID}/{YYYY-MM-DD}/{session_id}/
 *     raw.jsonl    — полный transcript CC (всё что было в сессии) — источник истины
 *     meta.json    — извлечённые поля (usage, tools, files, prompts) — БЕЗ LLM, каноническая схема
 *     summary.md   — рукописное саммари от CC по docs/session-finalize.md
 *   logs/claude-code/by-date/{YYYY}/{MM}/{DD}/{session_id}.pointer.json
 *   logs/claude-code/_index/all-sessions.jsonl  — одна строка на session_id
 *
 * Идемпотентно: повторный запуск с тем же sid обновит все 3 файла + pointer + index.
 * `rebuild` детерминирован: одинаковый набор raw.jsonl → одинаковые meta/index.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const ROOT = process.cwd();

function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

// ── args / mode ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const MODE = args[0] === 'rebuild' ? 'rebuild' : 'upload';

// ── env ──────────────────────────────────────────────────────────────────────
const BUCKET = process.env.S3_BUCKET;
if (!process.env.S3_ENDPOINT || !BUCKET) {
  console.error('S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY должны быть в .env');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'ru-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

// ── locate session JSONL ─────────────────────────────────────────────────────
function projectsDirForCwd(cwd) {
  // CC encoding: любой не-[A-Za-z0-9] символ → '-'. Примеры:
  //   /home/pavel/projects/smm-system  → -home-pavel-projects-smm-system
  //   C:\Users\Пользователь\Claude     → C--Users--------------Claude
  return path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
}

const INDEX_KEY = 'logs/claude-code/_index/all-sessions.jsonl';
const BY_PROJECT_PREFIX = 'logs/claude-code/by-project/';

// ── canonical parser: raw JSONL text → meta ──────────────────────────────────
// Единственное место, где JSONL превращается в meta. Используется и обычной
// заливкой, и rebuild — поэтому схема всегда одна.
function parseEvents(rawText) {
  const events = [];
  for (const line of rawText.split('\n')) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* пропускаем битые строки */ }
  }
  return events;
}

function buildMeta(events, { sessionId, projectId, rawSizeBytes }) {
  const firstTs = events.find(e => e.timestamp)?.timestamp ?? null;
  let lastTs = null;
  for (let i = events.length - 1; i >= 0; i--) { if (events[i].timestamp) { lastTs = events[i].timestamp; break; } }
  const durationSeconds = firstTs && lastTs ? Math.round((new Date(lastTs) - new Date(firstTs)) / 1000) : null;

  const aiTitle = events.find(e => e.type === 'ai-title')?.aiTitle ?? null;

  const firstUserEvent = events.find(e => e.type === 'user');
  const textOf = (c) => typeof c === 'string'
    ? c
    : Array.isArray(c) ? c.filter(b => b.type === 'text').map(b => b.text).join('\n') : '';
  const firstUserText = firstUserEvent ? textOf(firstUserEvent.message?.content) : '';

  const usageByModel = {};
  const toolCounts = {};
  const bashCommands = [];
  const filesRead = new Set();
  const filesWritten = new Set();
  const filesEdited = new Set();
  const subagentsInvoked = [];
  const userPrompts = [];

  for (const e of events) {
    if (e.type === 'user') {
      const t = textOf(e.message?.content);
      if (t) userPrompts.push(t);
    }
    if (e.type !== 'assistant') continue;
    const msg = e.message ?? {};
    const model = msg.model;
    const u = msg.usage;
    // <synthetic> — псевдо-сообщения CC (прерывания и т.п.), не реальный вызов модели
    if (model && model !== '<synthetic>' && u) {
      const acc = usageByModel[model] ??= { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, turns: 0 };
      acc.input_tokens += u.input_tokens ?? 0;
      acc.output_tokens += u.output_tokens ?? 0;
      acc.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
      acc.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
      acc.turns += 1;
    }
    for (const block of msg.content ?? []) {
      if (block?.type !== 'tool_use') continue;
      const name = block.name ?? '?';
      toolCounts[name] = (toolCounts[name] ?? 0) + 1;
      const input = block.input ?? {};
      if (name === 'Bash' && input.command) {
        bashCommands.push(String(input.command).replace(/\s+/g, ' ').slice(0, 300));
      } else if (name === 'Read' && input.file_path) {
        filesRead.add(input.file_path);
      } else if (name === 'Write' && input.file_path) {
        filesWritten.add(input.file_path);
      } else if (name === 'Edit' && input.file_path) {
        filesEdited.add(input.file_path);
      } else if (name === 'Agent') {
        subagentsInvoked.push({
          subagent_type: input.subagent_type ?? 'general-purpose',
          description: (input.description ?? '').slice(0, 200),
        });
      }
    }
  }

  const firstUserEvt = firstUserEvent ?? {};
  return {
    schema_version: 2,
    session_id: sessionId,
    project_id: projectId,
    ai_title: aiTitle,
    started_at: firstTs,
    ended_at: lastTs,
    duration_seconds: durationSeconds,
    operator: os.userInfo().username,
    hostname: os.hostname(),
    cwd: firstUserEvt.cwd ?? null,
    git_branch: firstUserEvt.gitBranch ?? null,
    cc_version: firstUserEvt.version ?? null,
    turns_total: events.filter(e => e.type === 'assistant').length,
    user_prompts_count: userPrompts.length,
    first_user_prompt: firstUserText ? firstUserText.slice(0, 2000) : null,
    models_used: Object.keys(usageByModel),
    usage_by_model: usageByModel,
    tool_counts: toolCounts,
    bash_commands: bashCommands,
    files_read: [...filesRead],
    files_written: [...filesWritten],
    files_edited: [...filesEdited],
    subagents_invoked: subagentsInvoked,
    raw_jsonl_size_bytes: rawSizeBytes,
    raw_jsonl_lines: events.length,
  };
}

// ── derived artifacts (одна точка истины для pointer и index) ─────────────────
function dateParts(meta) {
  const d = new Date(meta.started_at ?? 0);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { yyyy, mm, dd, ymd: `${yyyy}-${mm}-${dd}` };
}

function baseKeyFor(meta, ymd) {
  return `${BY_PROJECT_PREFIX}${meta.project_id}/${ymd}/${meta.session_id}`;
}

function buildPointer(meta, baseKey) {
  return {
    path: baseKey,
    session_id: meta.session_id,
    project_id: meta.project_id,
    ai_title: meta.ai_title,
    started_at: meta.started_at,
    ended_at: meta.ended_at,
  };
}

// Каноническая строка индекса — компактная, но самодостаточная для аналитики.
function buildIndexLine(meta, baseKey) {
  return {
    session_id: meta.session_id,
    project_id: meta.project_id,
    ai_title: meta.ai_title,
    started_at: meta.started_at,
    ended_at: meta.ended_at,
    duration_seconds: meta.duration_seconds,
    turns_total: meta.turns_total,
    user_prompts_count: meta.user_prompts_count,
    path: baseKey,
  };
}

// ── S3 helpers ────────────────────────────────────────────────────────────────
async function put(key, body, contentType) {
  if (DRY) return;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

async function getText(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const chunks = [];
    for await (const ch of r.Body) chunks.push(ch);
    return Buffer.concat(chunks).toString('utf8');
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NoSuchKey') return null;
    throw e;
  }
}

async function listKeys(prefix) {
  const keys = [];
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents ?? []) keys.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

// ── upload one session (default mode) ────────────────────────────────────────
async function runUpload() {
  if (args.length < 1 || args[0].startsWith('--')) {
    console.error('Usage: node tools/upload-session.mjs <ProjectID|_unscoped> --summary <path> [--session-id <UUID>] [--dry-run]');
    console.error('   or: node tools/upload-session.mjs rebuild [--dry-run]');
    process.exit(1);
  }
  const PROJECT_ID = args[0];
  const summaryPath = args.includes('--summary') ? args[args.indexOf('--summary') + 1] : null;
  const explicitSid = args.includes('--session-id') ? args[args.indexOf('--session-id') + 1] : null;

  if (!summaryPath) {
    console.error('Нужен --summary <path/to/summary.md> (саммари пишет сам CC по docs/session-finalize.md)');
    process.exit(1);
  }
  if (!fs.existsSync(summaryPath)) {
    console.error(`Файл саммари не найден: ${summaryPath}`);
    process.exit(1);
  }

  const sessionsDir = projectsDirForCwd(ROOT);
  if (!fs.existsSync(sessionsDir)) {
    console.error(`Нет директории сессий CC: ${sessionsDir}`);
    process.exit(1);
  }

  let sessionFile;
  if (explicitSid) {
    sessionFile = path.join(sessionsDir, `${explicitSid}.jsonl`);
    if (!fs.existsSync(sessionFile)) { console.error(`Нет файла сессии: ${sessionFile}`); process.exit(1); }
  } else {
    const candidates = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (!candidates.length) { console.error(`Нет .jsonl в ${sessionsDir}`); process.exit(1); }
    sessionFile = path.join(sessionsDir, candidates[0].f);
  }

  const sessionId = path.basename(sessionFile, '.jsonl');
  const rawBody = fs.readFileSync(sessionFile);
  const events = parseEvents(rawBody.toString('utf8'));
  const meta = buildMeta(events, { sessionId, projectId: PROJECT_ID, rawSizeBytes: rawBody.length });

  const { yyyy, mm, dd, ymd } = dateParts(meta);
  const baseKey = baseKeyFor(meta, ymd);
  const pointer = buildPointer(meta, baseKey);

  console.log(`session_id : ${sessionId}`);
  console.log(`project_id : ${PROJECT_ID}`);
  console.log(`title      : ${meta.ai_title ?? '(нет)'}`);
  console.log(`started    : ${meta.started_at}`);
  console.log(`duration   : ${meta.duration_seconds}s (${Math.round((meta.duration_seconds ?? 0) / 60)}min)`);
  console.log(`turns      : ${meta.turns_total}, prompts: ${meta.user_prompts_count}`);
  console.log(`models     : ${meta.models_used.join(', ') || '(нет)'}`);
  console.log(`tools      : ${Object.entries(meta.tool_counts).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  console.log(`s3 base    : s3://${BUCKET}/${baseKey}/`);
  if (DRY) {
    console.log('--- DRY RUN, ничего не залито ---');
    console.log(JSON.stringify(meta, null, 2).slice(0, 2000));
    return;
  }

  await put(`${baseKey}/raw.jsonl`, rawBody, 'application/x-ndjson');
  console.log(`✓ ${baseKey}/raw.jsonl (${(rawBody.length / 1024).toFixed(1)} KB)`);
  await put(`${baseKey}/meta.json`, JSON.stringify(meta, null, 2), 'application/json');
  console.log(`✓ ${baseKey}/meta.json`);
  const summaryBody = fs.readFileSync(summaryPath, 'utf8');
  await put(`${baseKey}/summary.md`, summaryBody, 'text/markdown; charset=utf-8');
  console.log(`✓ ${baseKey}/summary.md (${(summaryBody.length / 1024).toFixed(1)} KB)`);
  const pointerKey = `logs/claude-code/by-date/${yyyy}/${mm}/${dd}/${sessionId}.pointer.json`;
  await put(pointerKey, JSON.stringify(pointer, null, 2), 'application/json');
  console.log(`✓ ${pointerKey}`);

  // index — read-modify-write по session_id (rebuild чинит, если он рассыпался)
  const oldIndex = (await getText(INDEX_KEY)) ?? '';
  const lines = oldIndex.split('\n').filter(l => {
    if (!l.trim()) return false;
    try { return JSON.parse(l).session_id !== sessionId; } catch { return false; }
  });
  lines.push(JSON.stringify(buildIndexLine(meta, baseKey)));
  await put(INDEX_KEY, lines.join('\n') + '\n', 'application/x-ndjson');
  console.log(`✓ ${INDEX_KEY} (${lines.length} sessions)`);
}

// ── rebuild: перегенерировать всё из raw.jsonl ───────────────────────────────
async function runRebuild() {
  console.log(`rebuild: сканирую s3://${BUCKET}/${BY_PROJECT_PREFIX} …${DRY ? ' (DRY RUN)' : ''}`);
  const all = await listKeys(BY_PROJECT_PREFIX);
  const rawKeys = all.filter(k => k.endsWith('/raw.jsonl')).sort();
  console.log(`найдено сессий (raw.jsonl): ${rawKeys.length}`);

  const indexLines = [];
  for (const rawKey of rawKeys) {
    // logs/claude-code/by-project/{projectId}/{YYYY-MM-DD}/{sessionId}/raw.jsonl
    const parts = rawKey.split('/');
    const projectId = parts[3];
    const ymd = parts[4];
    const sessionId = parts[5];

    const rawText = await getText(rawKey);
    if (rawText == null) { console.warn(`  ! пропуск (нет тела): ${rawKey}`); continue; }
    const events = parseEvents(rawText);
    const meta = buildMeta(events, { sessionId, projectId, rawSizeBytes: Buffer.byteLength(rawText) });

    const baseKey = `${BY_PROJECT_PREFIX}${projectId}/${ymd}/${sessionId}`;
    const pointer = buildPointer(meta, baseKey);
    const { yyyy, mm, dd } = dateParts(meta);
    // by-date папка берётся из фактической папки by-project (ymd), а не из
    // пересчитанной даты — чтобы не плодить дубликаты pointer при сдвиге TZ.
    const [py, pmo, pda] = ymd.split('-');
    const pointerKey = `logs/claude-code/by-date/${py}/${pmo}/${pda}/${sessionId}.pointer.json`;

    await put(`${baseKey}/meta.json`, JSON.stringify(meta, null, 2), 'application/json');
    await put(pointerKey, JSON.stringify(pointer, null, 2), 'application/json');
    indexLines.push({ meta, baseKey });
    console.log(`  ✓ ${projectId}/${ymd}/${sessionId.slice(0, 8)} — ${meta.tool_counts && Object.keys(meta.tool_counts).length ? Object.entries(meta.tool_counts).map(([k, v]) => `${k}×${v}`).join(' ') : '(пусто)'}`);
  }

  // _index пересобираем целиком, отсортировав по started_at
  indexLines.sort((a, b) => String(a.meta.started_at).localeCompare(String(b.meta.started_at)));
  const body = indexLines.map(({ meta, baseKey }) => JSON.stringify(buildIndexLine(meta, baseKey))).join('\n') + '\n';
  await put(INDEX_KEY, body, 'application/x-ndjson');
  console.log(`\n✓ ${INDEX_KEY} пересобран: ${indexLines.length} сессий${DRY ? ' (DRY — не залито)' : ''}`);
}

(MODE === 'rebuild' ? runRebuild() : runUpload())
  .catch(e => { console.error(e); process.exit(1); });
