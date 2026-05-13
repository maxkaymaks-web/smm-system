#!/usr/bin/env node
/**
 * spend-per-msg.mjs — расход per-сообщение пользователя.
 *
 * Читает trajectory-файлы OpenClaw из ~/.openclaw/agents/main/sessions/.
 * Trajectory создаётся только для сообщений, которые бот реально обработал
 * (скипнутые и заблокированные сессий не имеют).
 *
 * Требует LITELLM_ADMIN_KEY в .env для запроса /spend/logs.
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
const LITELLM_ADMIN_KEY = process.env.LITELLM_ADMIN_KEY;

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

// ---------- extract user message from trajectory ----------
function extractUserMsg(lines) {
  // Берём первый human-message из первого messagesSnapshot
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

// ---------- LiteLLM /spend/logs (cached per day) ----------
const dayLogsCache = new Map();

async function getDayLogs(dateStr) {
  if (dayLogsCache.has(dateStr)) return dayLogsCache.get(dateStr);
  if (!LITELLM_URL || !LITELLM_KEY || !LITELLM_ADMIN_KEY) { dayLogsCache.set(dateStr, []); return []; }
  try {
    const r = await fetch(
      `${LITELLM_URL}/spend/logs?start_date=${dateStr}&end_date=${dateStr}&api_key=${LITELLM_KEY}`,
      { headers: { Authorization: `Bearer ${LITELLM_ADMIN_KEY}` } }
    );
    if (!r.ok) { dayLogsCache.set(dateStr, []); return []; }
    const body = await r.json();
    const items = Array.isArray(body) ? body : (body.data ?? []);
    dayLogsCache.set(dateStr, items);
    return items;
  } catch {
    dayLogsCache.set(dateStr, []);
    return [];
  }
}

async function getSessionCost(startTs, endTs) {
  const startDay = startTs.toISOString().slice(0, 10);
  const endDay = endTs.toISOString().slice(0, 10);
  const queryDays = [startDay];
  if (endDay !== startDay) queryDays.push(endDay);

  let total = 0;
  let hasTimestamps = false;

  for (const day of queryDays) {
    const items = await getDayLogs(day);
    for (const item of items) {
      const itemTs = item.startTime ?? item.created_at ?? item.timestamp ?? null;
      if (itemTs) {
        hasTimestamps = true;
        const t = new Date(itemTs);
        if (t < startTs || t > endTs) continue;
      }
      total += Number(item.spend ?? item.cost ?? 0);
    }
  }

  // Если у логов нет timestamps — помечаем как «приближённо» (весь день)
  return { total: +total.toFixed(6), approximate: !hasTimestamps };
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
  .sort((a, b) => b.mtime - a.mtime); // новые первые

if (isFinite(countLimit)) files = files.slice(0, countLimit);

if (files.length === 0) {
  console.log('Нет обработанных сессий за указанный период.');
  process.exit(0);
}

const results = [];

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

  // Пропускаем не-Telegram сессии
  if (!sessionKey.includes(':topic:')) continue;

  const projectId = projectFromKey(sessionKey) ?? 'general';
  const firstTs = first.ts ? new Date(first.ts) : new Date(ctime);
  const lastLine = lines[lines.length - 1];
  const endTs = lastLine.ts ? new Date(lastLine.ts) : new Date(mtime);

  const userMsg = extractUserMsg(lines);
  const msgPreview = userMsg
    ? userMsg.replace(/\s+/g, ' ').substring(0, 140) + (userMsg.length > 140 ? '…' : '')
    : '(текст не найден)';

  const { total, approximate } = await getSessionCost(firstTs, endTs);
  results.push({ projectId, firstTs, endTs, msgPreview, total, approximate });
}

// ---------- output ----------
function fmt$(n) {
  if (n === 0) return '$0.00';
  if (n < 0.005) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtTime(d) {
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

if (results.length === 0) {
  console.log('Нет данных для отображения.');
  process.exit(0);
}

if (!LITELLM_ADMIN_KEY) {
  const warn = '⚠️ LITELLM_ADMIN_KEY не задан — стоимость недоступна. Добавьте в .env.';
  console.error(wantTg ? warn : warn);
}

if (wantTg) {
  const lines = [`💬 <b>Расход per-запрос · последние ${results.length}</b>`, ''];
  for (const r of results) {
    const cost = LITELLM_ADMIN_KEY
      ? `<b>${fmt$(r.total)}</b>${r.approximate ? ' ~' : ''}`
      : '—';
    lines.push(`${fmtTime(r.firstTs)} [${r.projectId}] · ${cost}`);
    lines.push(r.msgPreview);
    lines.push('');
  }
  console.log(lines.join('\n').trimEnd());
} else {
  const sep = '─'.repeat(60);
  console.log(`💬 Расход per-запрос · последние ${results.length}\n${sep}`);
  for (const r of results) {
    const cost = LITELLM_ADMIN_KEY
      ? fmt$(r.total) + (r.approximate ? ' ~' : '')
      : '—';
    console.log(`${fmtTime(r.firstTs)}  [${r.projectId}]  ${cost}`);
    console.log(`  ${r.msgPreview}`);
    console.log('');
  }
}
