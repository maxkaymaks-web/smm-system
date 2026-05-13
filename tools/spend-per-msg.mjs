#!/usr/bin/env node
/**
 * spend-per-msg.mjs — расход per-сообщение пользователя.
 *
 * Читает trajectory-файлы OpenClaw из ~/.openclaw/agents/main/sessions/.
 * Trajectory создаётся только для сообщений, которые бот реально обработал
 * (скипнутые и заблокированные сессий не имеют).
 *
 * Стоимость берётся из LiteLLM_SpendLogs (PostgreSQL) через SSH на прокси.
 * Для этого на прокси-сервере должен быть SSH-ключ SMM-сервера в authorized_keys.
 *
 * Работает только на сервере (где живут trajectory файлы).
 *
 * Использование:
 *   node tools/spend-per-msg.mjs              # последние 10 обработанных сессий
 *   node tools/spend-per-msg.mjs --count 20   # последние 20
 *   node tools/spend-per-msg.mjs --days 3     # за последние 3 дня (без лимита по count)
 *   node tools/spend-per-msg.mjs --tg         # HTML-формат для Telegram
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const SESSIONS_DIR = path.join(os.homedir(), '.openclaw/agents/main/sessions');

// ---------- env ----------
const envPath = path.join(REPO_ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}
const LITELLM_KEY = process.env.LITELLM_KEY;
const PROXY_HOST = '5.2.66.188';
const PROXY_PORT = '24822';

// LiteLLM хранит ключи как SHA256 хэш
const KEY_HASH = LITELLM_KEY
  ? createHash('sha256').update(LITELLM_KEY).digest('hex')
  : null;

// ---------- args ----------
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const val = n => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };

const countLimit = val('--count') !== null ? parseInt(val('--count'), 10) : (val('--days') !== null ? Infinity : 10);
const daysFilter = val('--days') !== null ? parseInt(val('--days'), 10) : null;
const wantTg = flag('--tg');

// ---------- project map ----------
const TOPICS_FILE = path.join(REPO_ROOT, 'projects/topics.json');
const topicToProject = {};
if (fs.existsSync(TOPICS_FILE)) {
  const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  for (const [pid, info] of Object.entries(topics)) {
    if (info.thread_id) topicToProject[String(info.thread_id)] = pid;
  }
}

function projectFromKey(sessionKey) {
  const m = sessionKey?.match(/:topic:(\d+)$/);
  if (!m) return null;
  return topicToProject[m[1]] ?? `topic:${m[1]}`;
}

// ---------- extract user message ----------
function extractUserMsg(lines) {
  for (const e of lines) {
    const snap = e?.data?.messagesSnapshot;
    if (!Array.isArray(snap) || !snap.length) continue;
    for (const msg of snap) {
      if (msg.role !== 'human' && msg.role !== 'user') continue;
      const content = Array.isArray(msg.content) ? msg.content : [msg.content];
      for (const block of content) {
        if (!block) continue;
        const text = typeof block === 'string' ? block : (block.text ?? '');
        if (text.trim()) return text.trim();
      }
    }
    break;
  }
  return null;
}

// ---------- batch PostgreSQL query via SSH ----------
function queryPgSpend(sessions) {
  if (!KEY_HASH || sessions.length === 0) return sessions.map(() => null);

  // VALUES (idx, start_ts, end_ts), ...
  const rows = sessions.map((s, i) =>
    `(${i}, '${s.startTs.toISOString().replace('T', ' ').slice(0, 23)}'::timestamp, '${s.endTs.toISOString().replace('T', ' ').slice(0, 23)}'::timestamp)`
  ).join(',\n    ');

  const sql = `
WITH sessions(idx, start_ts, end_ts) AS (
  VALUES
    ${rows}
)
SELECT s.idx, COALESCE(sum(l.spend), 0) AS total
FROM sessions s
LEFT JOIN "LiteLLM_SpendLogs" l ON
  l."api_key" = '${KEY_HASH}'
  AND l."startTime" >= s.start_ts
  AND l."startTime" <= s.end_ts
GROUP BY s.idx
ORDER BY s.idx;
`.trim();

  const cmd = `docker exec litellm-postgres psql -U litellm litellm -t -A -F'|' -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

  try {
    const result = spawnSync(
      'ssh', ['-p', PROXY_PORT, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `root@${PROXY_HOST}`, cmd],
      { encoding: 'utf8', timeout: 30_000 }
    );
    if (result.status !== 0) return sessions.map(() => null);

    const costs = new Array(sessions.length).fill(null);
    for (const line of result.stdout.split('\n')) {
      const parts = line.trim().split('|');
      if (parts.length === 2) {
        const idx = parseInt(parts[0], 10);
        const cost = parseFloat(parts[1]);
        if (!isNaN(idx) && !isNaN(cost)) costs[idx] = cost;
      }
    }
    return costs;
  } catch {
    return sessions.map(() => null);
  }
}

// ---------- main ----------
if (!fs.existsSync(SESSIONS_DIR)) {
  console.error(`Нет директории сессий: ${SESSIONS_DIR}`);
  console.error('Запускать на сервере где работает OpenClaw.');
  process.exit(1);
}

const cutoff = daysFilter ? Date.now() - daysFilter * 86_400_000 : 0;

let files = fs.readdirSync(SESSIONS_DIR)
  .filter(f => f.endsWith('.trajectory.jsonl'))
  .map(f => {
    const full = path.join(SESSIONS_DIR, f);
    const stat = fs.statSync(full);
    return { full, mtime: stat.mtimeMs, ctime: stat.birthtimeMs || stat.ctimeMs };
  })
  .filter(f => f.mtime > cutoff)
  .sort((a, b) => b.mtime - a.mtime);

if (isFinite(countLimit)) files = files.slice(0, countLimit);

if (files.length === 0) {
  console.log('Нет обработанных сессий за указанный период.');
  process.exit(0);
}

const sessions = [];
for (const { full, mtime, ctime } of files) {
  let lines;
  try {
    lines = fs.readFileSync(full, 'utf8')
      .split('\n').filter(l => l.trim())
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { continue; }
  if (!lines.length) continue;

  const first = lines[0];
  const sessionKey = first.sessionKey ?? '';
  if (!sessionKey.includes(':topic:')) continue;

  const projectId = projectFromKey(sessionKey) ?? 'general';
  const startTs = first.ts ? new Date(first.ts) : new Date(ctime);
  const lastLine = lines[lines.length - 1];
  const endTs = lastLine.ts ? new Date(lastLine.ts) : new Date(mtime);

  const userMsg = extractUserMsg(lines);
  const msgPreview = userMsg
    ? userMsg.replace(/\s+/g, ' ').substring(0, 140) + (userMsg.length > 140 ? '…' : '')
    : '(текст не найден)';

  sessions.push({ projectId, startTs, endTs, msgPreview });
}

if (sessions.length === 0) {
  console.log('Нет данных для отображения.');
  process.exit(0);
}

// Batch-запрос стоимости всех сессий сразу
const costs = queryPgSpend(sessions);
const results = sessions.map((s, i) => ({ ...s, cost: costs[i] }));

// ---------- output ----------
function fmt$(n) {
  if (n == null) return '—';
  if (n === 0) return '$0.00';
  if (n < 0.005) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtTime(d) {
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

if (wantTg) {
  const lines = [`💬 <b>Расход per-запрос · последние ${results.length}</b>`, ''];
  for (const r of results) {
    lines.push(`${fmtTime(r.startTs)} [${r.projectId}] · <b>${fmt$(r.cost)}</b>`);
    lines.push(r.msgPreview);
    lines.push('');
  }
  console.log(lines.join('\n').trimEnd());
} else {
  console.log(`💬 Расход per-запрос · последние ${results.length}`);
  console.log('─'.repeat(60));
  for (const r of results) {
    console.log(`${fmtTime(r.startTs)}  [${r.projectId}]  ${fmt$(r.cost)}`);
    console.log(`  ${r.msgPreview}`);
    console.log('');
  }
}
