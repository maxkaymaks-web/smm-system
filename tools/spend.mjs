#!/usr/bin/env node
/**
 * spend.mjs — отчёт по тратам LiteLLM на проект smm-system.
 *
 * Использует master-key LiteLLM (admin) для запроса /key/info по smm-virtual-key
 * и /spend/logs за последние N дней.
 *
 * Требует в env:
 *   LITELLM_URL          — http://5.2.66.188:4000
 *   LITELLM_ADMIN_KEY    — master key (опционально, для /spend/logs)
 *   LITELLM_KEY          — SMM virtual key (для /key/info по нему)
 *
 * Использование:
 *   node tools/spend.mjs            # сводка
 *   node tools/spend.mjs --logs 7   # последние 7 дней detailed
 */

import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const URL = process.env.LITELLM_URL;
const SMM_KEY = process.env.LITELLM_KEY;
const ADMIN_KEY = process.env.LITELLM_ADMIN_KEY;

if (!URL || !SMM_KEY) {
  console.error('LITELLM_URL и LITELLM_KEY обязательны в .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const logsIdx = args.indexOf('--logs');
const logsDays = logsIdx !== -1 ? parseInt(args[logsIdx + 1] ?? '7', 10) : null;

async function get(p, key) {
  const r = await fetch(`${URL}${p}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

const info = await get(`/key/info?key=${SMM_KEY}`, ADMIN_KEY ?? SMM_KEY);
const i = info.info ?? info;

console.log('SMM-проект — расход LiteLLM');
console.log('───────────────────────────');
console.log(`Virtual key:    ${i.key_alias ?? i.key_name}`);
console.log(`Spend:          $${Number(i.spend ?? 0).toFixed(4)}`);
if (i.max_budget != null) {
  const pct = (i.spend / i.max_budget * 100).toFixed(1);
  console.log(`Budget:         $${i.max_budget} (${pct}% использовано) · цикл ${i.budget_duration ?? '—'}`);
}
console.log(`Models:         ${(i.models ?? []).join(', ')}`);

if (logsDays && ADMIN_KEY) {
  const since = new Date(Date.now() - logsDays * 86400_000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const logs = await get(`/spend/logs?start_date=${since}&end_date=${until}&api_key=${SMM_KEY}`, ADMIN_KEY);
  const items = Array.isArray(logs) ? logs : (logs.data ?? []);

  console.log(`\nДетали за последние ${logsDays} дней (${items.length} запросов)`);
  console.log('───────────────────────────');
  const byModel = new Map();
  for (const e of items) {
    const m = e.model ?? 'unknown';
    const c = Number(e.spend ?? e.cost ?? 0);
    byModel.set(m, (byModel.get(m) ?? 0) + c);
  }
  for (const [m, c] of [...byModel.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${m.padEnd(40)} $${c.toFixed(4)}`);
  }
} else if (logsDays) {
  console.log('\n--logs требует LITELLM_ADMIN_KEY в .env (master key прокси)');
}
