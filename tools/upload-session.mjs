#!/usr/bin/env node
/**
 * upload-session.mjs — выгрузка сессии Claude Code (JSONL + summary.md + meta.json) в S3.
 *
 * Использование:
 *   node tools/upload-session.mjs <ProjectID|_unscoped> --summary <path/to/summary.md>
 *   node tools/upload-session.mjs Lakmoda --summary /tmp/summary.md
 *   node tools/upload-session.mjs Lakmoda --summary /tmp/summary.md --session-id <UUID>
 *   node tools/upload-session.mjs Lakmoda --summary /tmp/summary.md --dry-run
 *
 * По умолчанию берёт самый свежий .jsonl из ~/.claude/projects/<encoded-cwd>/ —
 * это и есть текущая (только что закончившаяся) сессия.
 *
 * Структура в S3 (bucket=seo):
 *   logs/claude-code/by-project/{ProjectID}/{YYYY-MM-DD}/{session_id}/
 *     raw.jsonl    — полный transcript CC (всё что было в сессии)
 *     meta.json    — извлечённые поля (usage, tools, files, prompts) — БЕЗ LLM
 *     summary.md   — рукописное саммари от CC по docs/session-finalize.md
 *   logs/claude-code/by-date/{YYYY}/{MM}/{DD}/{session_id}.pointer.json
 *     — {"path": "by-project/.../{sid}", "project_id": "...", "title": "..."}
 *   logs/claude-code/_index/all-sessions.jsonl
 *     — append/update: одна строка на session_id (read-modify-write)
 *
 * Идемпотентно: повторный запуск с тем же sid обновит все 3 файла + pointer + index.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

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

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 1 || args[0].startsWith('--')) {
  console.error('Usage: node tools/upload-session.mjs <ProjectID|_unscoped> --summary <path> [--session-id <UUID>] [--dry-run]');
  process.exit(1);
}
const PROJECT_ID = args[0];
const DRY = args.includes('--dry-run');
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
  // CC encoding: / → -, rest as-is. Example:
  //   /home/pavel/projects/smm-system → -home-pavel-projects-smm-system
  return path.join(os.homedir(), '.claude', 'projects', cwd.replace(/\//g, '-'));
}

const sessionsDir = projectsDirForCwd(ROOT);
if (!fs.existsSync(sessionsDir)) {
  console.error(`Нет директории сессий CC: ${sessionsDir}`);
  process.exit(1);
}

let sessionFile;
if (explicitSid) {
  sessionFile = path.join(sessionsDir, `${explicitSid}.jsonl`);
  if (!fs.existsSync(sessionFile)) {
    console.error(`Нет файла сессии: ${sessionFile}`);
    process.exit(1);
  }
} else {
  // самый свежий .jsonl
  const candidates = fs.readdirSync(sessionsDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({ f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!candidates.length) {
    console.error(`Нет .jsonl в ${sessionsDir}`);
    process.exit(1);
  }
  sessionFile = path.join(sessionsDir, candidates[0].f);
}

const sessionId = path.basename(sessionFile, '.jsonl');

// ── parse JSONL → meta ───────────────────────────────────────────────────────
const events = [];
for (const line of fs.readFileSync(sessionFile, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try { events.push(JSON.parse(line)); } catch { /* пропускаем битые строки */ }
}

function pickFirstTimestamp() {
  for (const e of events) if (e.timestamp) return e.timestamp;
  return null;
}
function pickLastTimestamp() {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].timestamp) return events[i].timestamp;
  return null;
}

const startedAt = pickFirstTimestamp();
const endedAt = pickLastTimestamp();
const durationSeconds = startedAt && endedAt ? Math.round((new Date(endedAt) - new Date(startedAt)) / 1000) : null;

const aiTitle = events.find(e => e.type === 'ai-title')?.aiTitle ?? null;

// первый user prompt — обычно постановка задачи
const firstUserEvent = events.find(e => e.type === 'user');
const firstUserPrompt = firstUserEvent?.message?.content;
const firstUserText = typeof firstUserPrompt === 'string'
  ? firstUserPrompt
  : Array.isArray(firstUserPrompt)
    ? firstUserPrompt.filter(b => b.type === 'text').map(b => b.text).join('\n')
    : null;

const cwdInLog = firstUserEvent?.cwd ?? ROOT;
const gitBranch = firstUserEvent?.gitBranch ?? null;
const ccVersion = firstUserEvent?.version ?? null;

// usage суммируем по моделям, tool counts собираем по name
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
    const c = e.message?.content;
    const t = typeof c === 'string'
      ? c
      : Array.isArray(c) ? c.filter(b => b.type === 'text').map(b => b.text).join('\n') : '';
    if (t) userPrompts.push(t);
  }

  if (e.type !== 'assistant') continue;
  const msg = e.message ?? {};
  const model = msg.model;
  const u = msg.usage;
  if (model && u) {
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

// ── meta.json ────────────────────────────────────────────────────────────────
const date = new Date(startedAt ?? Date.now());
const ymd = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
const yyyy = date.getUTCFullYear();
const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
const dd = String(date.getUTCDate()).padStart(2, '0');

const meta = {
  session_id: sessionId,
  project_id: PROJECT_ID,
  ai_title: aiTitle,
  started_at: startedAt,
  ended_at: endedAt,
  duration_seconds: durationSeconds,
  operator: os.userInfo().username,
  hostname: os.hostname(),
  cwd: cwdInLog,
  git_branch: gitBranch,
  cc_version: ccVersion,
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
  raw_jsonl_size_bytes: fs.statSync(sessionFile).size,
  raw_jsonl_lines: events.length,
};

// ── S3 keys ──────────────────────────────────────────────────────────────────
const baseKey = `logs/claude-code/by-project/${PROJECT_ID}/${ymd}/${sessionId}`;
const keys = {
  raw: `${baseKey}/raw.jsonl`,
  meta: `${baseKey}/meta.json`,
  summary: `${baseKey}/summary.md`,
  pointer: `logs/claude-code/by-date/${yyyy}/${mm}/${dd}/${sessionId}.pointer.json`,
  index: `logs/claude-code/_index/all-sessions.jsonl`,
};

const pointer = {
  path: baseKey,
  session_id: sessionId,
  project_id: PROJECT_ID,
  ai_title: aiTitle,
  started_at: startedAt,
  ended_at: endedAt,
};

// ── upload ───────────────────────────────────────────────────────────────────
async function put(key, body, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: body,
    ContentType: contentType,
  }));
}

async function readIndex() {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: keys.index }));
    const chunks = [];
    for await (const ch of r.Body) chunks.push(ch);
    return Buffer.concat(chunks).toString('utf8');
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NoSuchKey') return '';
    throw e;
  }
}

async function main() {
  console.log(`session_id : ${sessionId}`);
  console.log(`project_id : ${PROJECT_ID}`);
  console.log(`title      : ${aiTitle ?? '(нет)'}`);
  console.log(`started    : ${startedAt}`);
  console.log(`duration   : ${durationSeconds}s (${Math.round((durationSeconds ?? 0) / 60)}min)`);
  console.log(`turns      : ${meta.turns_total}, prompts: ${meta.user_prompts_count}`);
  console.log(`models     : ${meta.models_used.join(', ') || '(нет)'}`);
  console.log(`tools      : ${Object.entries(meta.tool_counts).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  console.log(`s3 base    : s3://${BUCKET}/${baseKey}/`);
  if (DRY) {
    console.log('--- DRY RUN, ничего не залито ---');
    console.log(JSON.stringify(meta, null, 2).slice(0, 2000));
    return;
  }

  const rawBody = fs.readFileSync(sessionFile);
  const summaryBody = fs.readFileSync(summaryPath, 'utf8');
  const metaBody = JSON.stringify(meta, null, 2);
  const pointerBody = JSON.stringify(pointer, null, 2);

  await put(keys.raw, rawBody, 'application/x-ndjson');
  console.log(`✓ ${keys.raw} (${(rawBody.length / 1024).toFixed(1)} KB)`);
  await put(keys.meta, metaBody, 'application/json');
  console.log(`✓ ${keys.meta}`);
  await put(keys.summary, summaryBody, 'text/markdown; charset=utf-8');
  console.log(`✓ ${keys.summary} (${(summaryBody.length / 1024).toFixed(1)} KB)`);
  await put(keys.pointer, pointerBody, 'application/json');
  console.log(`✓ ${keys.pointer}`);

  // index — read-modify-write по session_id
  const oldIndex = await readIndex();
  const indexLines = oldIndex.split('\n').filter(l => {
    if (!l.trim()) return false;
    try { return JSON.parse(l).session_id !== sessionId; } catch { return false; }
  });
  indexLines.push(JSON.stringify(pointer));
  await put(keys.index, indexLines.join('\n') + '\n', 'application/x-ndjson');
  console.log(`✓ ${keys.index} (${indexLines.length} sessions)`);
}

main().catch(e => { console.error(e); process.exit(1); });
