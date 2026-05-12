#!/usr/bin/env node
/**
 * session-watchdog.mjs — мониторинг таймаутов OpenClaw сессий.
 *
 * Запускать через cron каждую минуту:
 *   * * * * * cd /root/smm-system && node tools/session-watchdog.mjs >> /tmp/session-watchdog.log 2>&1
 *
 * Если сессия завершилась по таймауту — шлёт уведомление в нужный Telegram-топик:
 *   - последние слова бота (до 2 фраз)
 *   - запрос оператора (из finalPromptText)
 *   - причина таймаута
 *   - инструкция повторить
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SMM_ROOT = path.resolve(__dirname, '..');
const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions';
const STATE_FILE = '/tmp/session-watchdog.state.json';
const TG_SEND = path.join(SMM_ROOT, 'tools/tg-send.mjs');
const TOPICS_FILE = path.join(SMM_ROOT, 'projects/topics.json');

// --- state: уже отправленные сессии ---
let processedSessions = new Set();
if (fs.existsSync(STATE_FILE)) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    processedSessions = new Set(state.processed || []);
    if (processedSessions.size > 2000) {
      processedSessions = new Set([...processedSessions].slice(-1000));
    }
  } catch { /* corrupt state — start fresh */ }
}

// --- обратный маппинг thread_id → ProjectID ---
const topics = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
const topicIdToProject = {};
for (const [projectId, info] of Object.entries(topics)) {
  if (info.thread_id) topicIdToProject[String(info.thread_id)] = projectId;
}

// --- сканируем trajectory-файлы за последние 25 минут ---
const cutoff = Date.now() - 25 * 60 * 1000;

let files = [];
try {
  files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.trajectory.jsonl'))
    .map(f => path.join(SESSIONS_DIR, f))
    .filter(f => {
      try { return fs.statSync(f).mtimeMs > cutoff; } catch { return false; }
    });
} catch (e) {
  console.error(`[watchdog] Cannot read sessions dir: ${e.message}`);
  process.exit(0);
}

const newlyProcessed = [];

for (const filePath of files) {
  let lines;
  try {
    lines = fs.readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { continue; }

  // ищем model.completed с timedOut=true
  const timedOutEvent = lines.find(d =>
    d.type === 'model.completed' && d.data?.timedOut === true
  );
  if (!timedOutEvent) continue;

  const sessionId = timedOutEvent.sessionId;
  if (!sessionId || processedSessions.has(sessionId)) continue;

  // топик из sessionKey: "agent:main:telegram:group:-1003738582316:topic:7"
  const sessionKey = timedOutEvent.sessionKey || '';
  const topicMatch = sessionKey.match(/:topic:(\d+)$/);
  if (!topicMatch) {
    // не Telegram-сессия (например DM), пропускаем
    newlyProcessed.push(sessionId);
    continue;
  }
  const topicId = topicMatch[1];
  const projectId = topicIdToProject[topicId];
  if (!projectId) {
    console.log(`[watchdog] Unknown topic_id=${topicId} — пропускаем`);
    newlyProcessed.push(sessionId);
    continue;
  }

  const data = timedOutEvent.data;

  // причина таймаута
  const reason = data.timedOutDuringToolExecution ? 'во время выполнения инструмента' :
                 data.idleTimedOut                ? 'из-за простоя (idle)' :
                 data.timedOutDuringCompaction    ? 'во время компакшна контекста' :
                                                   '';

  // последние тул-коллы из messagesSnapshot
  // структура OpenClaw: toolCall { type, id, name, arguments } + toolResult { type: "text", text }
  const snap = data.messagesSnapshot || [];

  const toolPairs = []; // { tool, cmd, result }
  let pending = null;

  for (const msg of snap) {
    const role = msg.role || '';
    const content = msg.content;
    const blocks = Array.isArray(content) ? content : [];

    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;

      if (block.type === 'toolCall') {
        const name = block.name || '?';
        const args = block.arguments || {};
        // exec → показываем команду; остальные → JSON аргументов
        const cmd = (name === 'exec' && args.command)
          ? String(args.command).replace(/\s+/g, ' ').trim().substring(0, 160)
          : `${name} ${JSON.stringify(args).substring(0, 100)}`;
        pending = { tool: name, cmd };
      } else if (role === 'toolResult' && block.type === 'text') {
        const txt = (block.text || '').trim();
        const firstLine = txt.split('\n')[0];

        // фильтруем мусор
        const isNoise = !txt
          || txt === '(no output)'
          || txt.startsWith('Usage: node ')
          || txt.startsWith('Example ')
          || /EXISTS|NOT FOUND/.test(txt)   // ls/test file checks
          || /^[\w/.\-:]+$/.test(firstLine) // bare path with no context
          || pending?.tool === 'update_plan'
          || pending?.tool === 'image';     // image analysis — слишком длинно

        if (pending) {
          if (!isNoise) {
            toolPairs.push({ tool: pending.tool, cmd: pending.cmd, result: firstLine.substring(0, 200) });
          }
          pending = null;
        }
      }
    }
  }

  // незавершённый последний тул (таймаут во время него)
  if (pending) {
    toolPairs.push({ tool: pending.tool, cmd: pending.cmd, result: '(ответа не было — таймаут)' });
  }

  // последние 4 пары
  const dedupLog = toolPairs.slice(-4).map(p =>
    `→ ${p.tool}: ${p.cmd}\n  ⟵ ${p.result}`
  );

  // собираем сообщение
  const lines2 = [
    `⏱ Сессия упала по таймауту${reason ? ` (${reason})` : ''} — задача не выполнена.`,
  ];
  if (dedupLog.length) lines2.push(`\n📋 Последние действия:\n${dedupLog.join('\n')}`);
  lines2.push('\n↩️ Повторите запрос — бот снова готов.');

  const msg = lines2.join('\n');

  try {
    execFileSync('node', [TG_SEND, projectId, '--text', msg], {
      cwd: SMM_ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    console.log(`[watchdog] ${new Date().toISOString()} timeout → ${projectId} (topic ${topicId}) session=${sessionId.substring(0, 8)}`);
    newlyProcessed.push(sessionId);
  } catch (e) {
    console.error(`[watchdog] Не удалось отправить в ${projectId}: ${e.message}`);
    // не добавляем в processedSessions — попробуем снова на следующем тике
  }
}

// сохраняем состояние
const updated = new Set([...processedSessions, ...newlyProcessed]);
fs.writeFileSync(STATE_FILE, JSON.stringify({
  processed: [...updated],
  lastRun: new Date().toISOString(),
}, null, 2));
