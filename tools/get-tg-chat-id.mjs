#!/usr/bin/env node
/**
 * get-tg-chat-id.mjs — найти chat_id Telegram-групп, куда бот добавлен.
 *
 * 1. Создай бота в @BotFather, получи токен.
 * 2. Добавь бота в группу и отправь там любое сообщение (например, /start).
 * 3. Запусти: TELEGRAM_BOT_TOKEN=123:abc node tools/get-tg-chat-id.mjs
 *
 * Скрипт выведет список chat_id (групп и личек) из последних апдейтов.
 * Для группы chat_id отрицательный, у супергрупп начинается с -100.
 *
 * Если токен взят из .env репо — просто запусти без переменной:
 *   node tools/get-tg-chat-id.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

let token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^TELEGRAM_BOT_TOKEN=(.+)$/);
      if (m) { token = m[1].trim(); break; }
    }
  }
}

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN не задан (ни в env, ни в .env)');
  process.exit(1);
}

const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=2`);
if (!r.ok) {
  console.error(`HTTP ${r.status}: ${await r.text()}`);
  process.exit(1);
}
const d = await r.json();

if (!d.ok || !Array.isArray(d.result) || d.result.length === 0) {
  console.error('Апдейтов нет. Отправь любое сообщение боту (в группу или в личку), затем повтори.');
  process.exit(1);
}

console.log('Найденные chats:');
console.log('───────────────');
const seen = new Set();
for (const u of d.result) {
  const msg = u.message ?? u.edited_message ?? u.channel_post;
  if (!msg) continue;
  const c = msg.chat;
  const key = c.id;
  if (seen.has(key)) continue;
  seen.add(key);
  const title = c.title ?? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() ?? c.username ?? '—';
  const tag = c.type === 'private' ? 'ЛС' : c.type === 'group' ? 'group' : c.type === 'supergroup' ? 'supergroup' : c.type;
  console.log(`  ${String(c.id).padEnd(16)} ${tag.padEnd(10)} ${title}`);
}
console.log('');
console.log('Для openclaw.json:');
console.log('  groups: { "<chat_id>": { requireMention: true } }');
console.log('Для DM-allowlist:');
console.log('  allowFrom: [ "<user_id>" ]   ← это id из колонки выше для type=ЛС');
