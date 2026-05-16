#!/usr/bin/env node
/**
 * spend-per-msg.mjs — расход per-сообщение пользователя.
 *
 * Читает trajectory-файлы OpenClaw из ~/.openclaw/agents/main/sessions/.
 * Trajectory создаётся только для сообщений, которые бот реально обработал
 * (скипнутые и заблокированные сессий не имеют).
 *
 * Стоимость считается точно: для каждой сессии берём request_id из LiteLLM
 * /spend/logs/v2 и для каждого дёргаем OpenRouter /generation (там total_cost
 * с учётом cache_read, чего LiteLLM stream-режим теряет — issue #7790 not planned).
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
const LITELLM_URL = process.env.LITELLM_URL;
const LITELLM_KEY = process.env.LITELLM_KEY;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY;
const OR_KEY = process.env.OPENROUTER_API_KEY_SMM;

// LiteLLM хранит api_key как SHA256 хэш
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

// ---------- точная стоимость сессий через OpenRouter ----------
// LiteLLM в stream-режиме теряет cache_creation/cache_read из usage
// (BerriAI/litellm#7790 closed as not planned) → SpendLogs.spend завышен.
// Берём request_id (=OpenRouter gen-...) из /spend/logs/v2 и дёргаем OR.
async function querySpend(sessions) {
  if (!LITELLM_URL || !LITELLM_MASTER_KEY || !OR_KEY || sessions.length === 0) {
    return sessions.map(() => null);
  }

  // широкое окно — мин(startTs)..макс(endTs)
  const minTs = sessions.reduce((m, s) => s.startTs < m ? s.startTs : m, sessions[0].startTs);
  const maxTs = sessions.reduce((m, s) => s.endTs > m ? s.endTs : m, sessions[0].endTs);
  // /spend/logs/v2 end_date эксклюзивный → сдвигаем на +1
  const since = minTs.toISOString().slice(0, 10);
  const untilDate = new Date(maxTs);
  untilDate.setUTCDate(untilDate.getUTCDate() + 1);
  const until = untilDate.toISOString().slice(0, 10);

  const entries = [];
  try {
    for (let page = 1; ; page++) {
      const u = new URL(`${LITELLM_URL}/spend/logs/v2`);
      u.searchParams.set('start_date', since);
      u.searchParams.set('end_date', until);
      u.searchParams.set('page', page);
      u.searchParams.set('page_size', 100);
      const r = await fetch(u, { headers: { Authorization: `Bearer ${LITELLM_MASTER_KEY}` } });
      if (!r.ok) return sessions.map(() => null);
      const j = await r.json();
      for (const e of (j.data || [])) {
        if (KEY_HASH && e.api_key && e.api_key !== KEY_HASH) continue;
        if (!e.request_id?.startsWith('gen-')) continue;
        entries.push({ request_id: e.request_id, ts: new Date(e.startTime) });
      }
      if (page >= (j.total_pages || 1)) break;
    }
  } catch { return sessions.map(() => null); }

  // group entries -> sessions by timestamp range
  const buckets = sessions.map(() => []);
  for (const e of entries) {
    for (let i = 0; i < sessions.length; i++) {
      if (e.ts >= sessions[i].startTs && e.ts <= sessions[i].endTs) {
        buckets[i].push(e);
        break;
      }
    }
  }

  // fetch OR /generation параллельно (10 одновременных)
  const flat = [];
  for (let i = 0; i < sessions.length; i++) for (const e of buckets[i]) flat.push({ i, request_id: e.request_id });
  const costs = new Map();
  let idx = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (idx < flat.length) {
      const item = flat[idx++];
      try {
        const r = await fetch(`https://openrouter.ai/api/v1/generation?id=${item.request_id}`, {
          headers: { Authorization: `Bearer ${OR_KEY}` },
        });
        if (!r.ok) continue;
        const j = await r.json().catch(() => null);
        if (!j?.data) continue;
        costs.set(item.request_id, j.data.total_cost || 0);
      } catch {}
    }
  }));

  const totals = sessions.map((_, i) => {
    let total = 0, any = false;
    for (const e of buckets[i]) {
      if (costs.has(e.request_id)) { total += costs.get(e.request_id); any = true; }
    }
    return any ? +total.toFixed(6) : 0;
  });
  return totals;
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

// Точная стоимость через OpenRouter (LiteLLM SpendLogs.spend завышен для stream)
const costs = await querySpend(sessions);
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
