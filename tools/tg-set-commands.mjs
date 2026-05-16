#!/usr/bin/env node
/**
 * tg-set-commands.mjs — зарегистрировать список команд бота в Telegram.
 *
 * После выполнения команды появятся в меню "/" у любого оператора в группе.
 *
 * Запускать вручную после изменения списка команд:
 *   node tools/tg-set-commands.mjs
 *
 * Для удаления всех команд:
 *   node tools/tg-set-commands.mjs --clear
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// env
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN не задан в .env'); process.exit(1); }

const BASE = `https://api.telegram.org/bot${TOKEN}`;

const COMMANDS = [
  { command: 'spend',       description: 'Расход за 24 часа → топик Бабки' },
  { command: 'spend_week',  description: 'Расход за 7 дней → топик Бабки' },
  { command: 'spend_month', description: 'Расход за месяц → топик Бабки' },
  { command: 'spend_msg',   description: 'Расход per-запрос (последние 10) → топик Бабки' },
  { command: 'spend_msg20', description: 'Расход per-запрос (последние 20) → топик Бабки' },
];

async function call(method, body) {
  const r = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(`${method}: ${d.description}`);
  return d.result;
}

const clear = process.argv.includes('--clear');

if (clear) {
  await call('deleteMyCommands', {});
  console.log('✓ Все команды удалены');
} else {
  // setMyCommands заменяет весь список. OpenClaw при старте регистрирует свои
  // системные команды (/new, /reset, /help, ...) — если переписать только нашими,
  // системные пропадут из меню. Сливаем: текущие + наши (наши перекрывают одноимённые).
  const existing = await call('getMyCommands', {});
  const ourCmds = new Set(COMMANDS.map(c => c.command));
  const merged = [
    ...existing.filter(c => !ourCmds.has(c.command)),
    ...COMMANDS,
  ];
  await call('setMyCommands', { commands: merged });
  console.log(`✓ Зарегистрировано ${COMMANDS.length} наших команд (всего в меню: ${merged.length}):`);
  for (const c of COMMANDS) console.log(`  /${c.command} — ${c.description}`);
}
