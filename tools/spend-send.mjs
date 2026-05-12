#!/usr/bin/env node
/**
 * spend-send.mjs — собрать отчёт о расходе и отправить в топик «💸 Бабки».
 *
 *   node tools/spend-send.mjs --period 24h     # дневной (вызывается из systemd)
 *   node tools/spend-send.mjs --period month   # месячный (1-го числа)
 *   node tools/spend-send.mjs --period 7d      # руками — за неделю
 *
 * Берёт текст из `spend-report.mjs --period X`, добавляет шапку с эмодзи под период,
 * шлёт через `tg-send.mjs finance` (topic_id из projects/topics.json).
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const args = process.argv.slice(2);
const val = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const period = val('--period');
if (!period) {
  console.error('usage: spend-send.mjs --period 24h|7d|30d|month');
  process.exit(1);
}

const HEADER = {
  '24h':   '💸 Вчера потрачено',
  '7d':    '💸 За последние 7 дней',
  '30d':   '💸 За последние 30 дней',
  'month': '💸 Итог месяца',
};

// 1. Получить текст отчёта (без JSON, без шапки — её добавим)
const reportProc = spawnSync('node', ['tools/spend-report.mjs', '--period', period], {
  cwd: REPO_ROOT, encoding: 'utf8',
});
if (reportProc.status !== 0) {
  console.error('spend-report failed:', reportProc.stderr);
  process.exit(reportProc.status ?? 1);
}
const report = reportProc.stdout.trimEnd();

// 2. Заголовок
const today = new Date().toISOString().slice(0, 10);
const header = `${HEADER[period] ?? '💸 Расход'} · ${today}`;

const message = `${header}\n\n${report}`;

// 3. Отправить в топик finance
const sendProc = spawnSync('node', ['tools/tg-send.mjs', 'finance', '--text', message], {
  cwd: REPO_ROOT, encoding: 'utf8', stdio: 'inherit',
});
process.exit(sendProc.status ?? 0);
