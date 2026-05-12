#!/usr/bin/env node
/**
 * spend-report.mjs — расход проекта за период.
 *
 * Источники:
 *   • LiteLLM /key/info        — cumulative по virtual key smm-openclaw (только наши LLM-вызовы)
 *   • Apify /v2/users/me/usage/monthly — cumulative по биллинг-циклу
 *   • state/fal-spend.jsonl    — каждый fal-вызов из tools/lib/fal-meter.mjs, оценка по fal-prices.json
 *
 * Дельты считаются через snapshot'ы в state/spend-snapshots.jsonl
 * (snapshot пишется по `--snapshot`, обычно из systemd timer'а раз в день).
 *
 * Использование:
 *   node tools/spend-report.mjs --snapshot            # записать snapshot текущих cumulative
 *   node tools/spend-report.mjs --period 24h          # дневной отчёт
 *   node tools/spend-report.mjs --period 7d           # неделя
 *   node tools/spend-report.mjs --period 30d          # 30 дней
 *   node tools/spend-report.mjs --period month        # текущий календарный месяц
 *   node tools/spend-report.mjs --from 2026-05-01 --to 2026-05-10
 *   node tools/spend-report.mjs --period 24h --json   # JSON для daily_briefing.py
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const STATE_DIR = path.join(REPO_ROOT, 'state');
const SNAPSHOT_FILE = path.join(STATE_DIR, 'spend-snapshots.jsonl');
const FAL_LOG = path.join(STATE_DIR, 'fal-spend.jsonl');

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
const APIFY_TOKEN = process.env.APIFY_TOKEN;

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (n) => args.indexOf(n);
const val = (n) => { const i = flag(n); return i === -1 ? null : args[i + 1]; };

const isSnapshotMode = flag('--snapshot') !== -1;
const wantJson = flag('--json') !== -1;
const period = val('--period');
const from = val('--from');
const to = val('--to');

// ---------- period -> {fromTs, toTs} ----------
function resolvePeriod() {
  const now = new Date();
  if (from && to) {
    return {
      fromTs: new Date(from + 'T00:00:00Z'),
      toTs:   new Date(to   + 'T23:59:59Z'),
      label:  `${from} → ${to}`,
    };
  }
  const presets = {
    '24h':  () => ({ fromTs: new Date(now - 86400_000), toTs: now, label: 'последние 24 часа' }),
    '7d':   () => ({ fromTs: new Date(now - 7  * 86400_000), toTs: now, label: 'последние 7 дней' }),
    '30d':  () => ({ fromTs: new Date(now - 30 * 86400_000), toTs: now, label: 'последние 30 дней' }),
    'month': () => {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { fromTs: start, toTs: now, label: `${start.toISOString().slice(0, 7)} (текущий календарный месяц)` };
    },
  };
  if (!period || !presets[period]) {
    console.error(`Укажите --period 24h|7d|30d|month или --from YYYY-MM-DD --to YYYY-MM-DD`);
    process.exit(1);
  }
  return presets[period]();
}

// ---------- snapshots ----------
function readSnapshots() {
  if (!fs.existsSync(SNAPSHOT_FILE)) return [];
  return fs.readFileSync(SNAPSHOT_FILE, 'utf8')
    .split('\n').filter(Boolean).map(JSON.parse);
}
function findSnapshotAt(ts) {
  // Берём последний snapshot, чей ts <= target (== "состояние на начало периода")
  const snaps = readSnapshots().filter(s => new Date(s.ts) <= ts);
  return snaps.length ? snaps[snaps.length - 1] : null;
}
function appendSnapshot(snap) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.appendFileSync(SNAPSHOT_FILE, JSON.stringify(snap) + '\n');
}

// ---------- sources ----------
async function fetchLitellm() {
  if (!LITELLM_URL || !LITELLM_KEY) return { available: false, reason: 'no LITELLM_URL/KEY' };
  try {
    const r = await fetch(`${LITELLM_URL}/key/info?key=${LITELLM_KEY}`, {
      headers: { Authorization: `Bearer ${LITELLM_KEY}` },
    });
    if (!r.ok) return { available: false, reason: `HTTP ${r.status}` };
    const d = await r.json();
    const info = d.info ?? d;
    return {
      available: true,
      cumulative_usd: Number(info.spend ?? 0),
      max_budget:    info.max_budget ?? null,
      budget_duration: info.budget_duration ?? null,
      budget_reset_at: info.budget_reset_at ?? null,
    };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

async function fetchApify() {
  if (!APIFY_TOKEN) return { available: false, reason: 'no APIFY_TOKEN' };
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${APIFY_TOKEN}`);
    if (!r.ok) return { available: false, reason: `HTTP ${r.status}` };
    const d = await r.json();
    const data = d.data ?? {};
    // Сумма по всем услугам в текущем биллинг-цикле (после volume-скидок)
    const services = data.monthlyServiceUsage ?? {};
    let total = 0;
    for (const v of Object.values(services)) total += Number(v.amountAfterVolumeDiscountUsd ?? v.baseAmountUsd ?? 0);
    return {
      available: true,
      cumulative_usd: +total.toFixed(6),
      cycle_start: data.usageCycle?.startAt ?? null,
      cycle_end:   data.usageCycle?.endAt ?? null,
    };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

function fetchFal(fromTs, toTs) {
  if (!fs.existsSync(FAL_LOG)) return { available: true, period_usd: 0, calls: 0, by_model: {} };
  const lines = fs.readFileSync(FAL_LOG, 'utf8').split('\n').filter(Boolean);
  const byModel = new Map();
  let total = 0, calls = 0, unknown = 0;
  for (const line of lines) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const t = new Date(e.ts);
    if (t < fromTs || t > toTs) continue;
    if (!e.ok) continue;
    calls++;
    if (e.estimated_usd == null) { unknown++; continue; }
    total += Number(e.estimated_usd);
    byModel.set(e.model, (byModel.get(e.model) ?? 0) + Number(e.estimated_usd));
  }
  return {
    available: true,
    period_usd: +total.toFixed(6),
    calls,
    unknown_priced_calls: unknown,
    by_model: Object.fromEntries([...byModel.entries()].sort((a, b) => b[1] - a[1])),
  };
}

function fetchFalCumulative() {
  if (!fs.existsSync(FAL_LOG)) return 0;
  let total = 0;
  for (const line of fs.readFileSync(FAL_LOG, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const e = JSON.parse(line);
      if (e.ok && e.estimated_usd != null) total += Number(e.estimated_usd);
    } catch {}
  }
  return +total.toFixed(6);
}

// ---------- modes ----------
async function doSnapshot() {
  const [litellm, apify] = await Promise.all([fetchLitellm(), fetchApify()]);
  const snap = {
    ts: new Date().toISOString(),
    litellm_cumulative_usd: litellm.available ? litellm.cumulative_usd : null,
    apify_cumulative_usd:   apify.available   ? apify.cumulative_usd   : null,
    fal_cumulative_usd:     fetchFalCumulative(),
  };
  appendSnapshot(snap);
  if (wantJson) console.log(JSON.stringify(snap));
  else {
    console.log('✓ snapshot сохранён в', path.relative(REPO_ROOT, SNAPSHOT_FILE));
    console.log('  ts:               ', snap.ts);
    console.log('  litellm $:        ', snap.litellm_cumulative_usd ?? '(unavailable)');
    console.log('  apify $:          ', snap.apify_cumulative_usd ?? '(unavailable)');
    console.log('  fal $ (cumulative):', snap.fal_cumulative_usd);
  }
}

function fmt$(n) {
  if (n == null) return '—';
  if (n === 0)   return '$0.0000';
  if (n < 0.01)  return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

async function doReport() {
  const { fromTs, toTs, label } = resolvePeriod();
  const [litellm, apify] = await Promise.all([fetchLitellm(), fetchApify()]);
  const fal = fetchFal(fromTs, toTs);
  const baseSnap = findSnapshotAt(fromTs);

  // LiteLLM delta
  let llmDelta = null, llmCaveat = null;
  if (litellm.available) {
    if (baseSnap && baseSnap.litellm_cumulative_usd != null) {
      llmDelta = litellm.cumulative_usd - baseSnap.litellm_cumulative_usd;
      if (llmDelta < 0) {
        llmCaveat = `бюджет ключа сбрасывался в периоде — оценка занижена`;
        llmDelta = litellm.cumulative_usd; // показываем текущее cumulative как proxy
      }
    } else {
      llmCaveat = 'нет snapshot для начала периода — показываю текущее cumulative с момента последнего reset';
      llmDelta = litellm.cumulative_usd;
    }
  }

  // Apify delta
  let apifyDelta = null, apifyCaveat = null;
  if (apify.available) {
    if (baseSnap && baseSnap.apify_cumulative_usd != null) {
      apifyDelta = apify.cumulative_usd - baseSnap.apify_cumulative_usd;
      if (apifyDelta < 0) {
        apifyCaveat = `биллинг-цикл Apify reset'нулся в периоде (start: ${apify.cycle_start?.slice(0, 10)})`;
        apifyDelta = apify.cumulative_usd;
      }
    } else {
      apifyCaveat = 'нет snapshot — показываю весь текущий цикл';
      apifyDelta = apify.cumulative_usd;
    }
  }

  const totalUsd = (llmDelta ?? 0) + (apifyDelta ?? 0) + fal.period_usd;

  const out = {
    period: { from: fromTs.toISOString(), to: toTs.toISOString(), label, baseline_snapshot_at: baseSnap?.ts ?? null },
    total_usd: +totalUsd.toFixed(4),
    sources: {
      litellm: litellm.available ? { usd: llmDelta == null ? null : +llmDelta.toFixed(4), cumulative_now: litellm.cumulative_usd, budget: litellm.max_budget, caveat: llmCaveat } : { available: false, reason: litellm.reason },
      apify:   apify.available   ? { usd: apifyDelta == null ? null : +apifyDelta.toFixed(4), cumulative_now: apify.cumulative_usd, cycle: { start: apify.cycle_start, end: apify.cycle_end }, caveat: apifyCaveat } : { available: false, reason: apify.reason },
      fal: { usd: fal.period_usd, calls: fal.calls, unknown_priced_calls: fal.unknown_priced_calls, by_model: fal.by_model },
    },
  };

  if (wantJson) { console.log(JSON.stringify(out, null, 2)); return; }

  const lines = [];
  lines.push(`💸 Расход — ${label}`);
  lines.push('─'.repeat(50));
  lines.push(`Итого: ${fmt$(totalUsd)}`);
  lines.push('');
  lines.push(`  LLM (LiteLLM):  ${fmt$(llmDelta)}${llmCaveat ? ` ⚠ ${llmCaveat}` : ''}`);
  if (litellm.available && litellm.max_budget) {
    const pct = (litellm.cumulative_usd / litellm.max_budget * 100).toFixed(0);
    lines.push(`                  ${fmt$(litellm.cumulative_usd)} / $${litellm.max_budget} цикла (${pct}%)`);
  }
  lines.push(`  fal.ai:         ${fmt$(fal.period_usd)}   (${fal.calls} вызов${fal.calls === 1 ? '' : 'ов'})`);
  if (fal.unknown_priced_calls > 0) {
    lines.push(`                  ⚠ ${fal.unknown_priced_calls} вызов(ов) без цены (нет в fal-prices.json)`);
  }
  if (Object.keys(fal.by_model).length) {
    for (const [m, v] of Object.entries(fal.by_model)) {
      lines.push(`                    · ${m.padEnd(38)} ${fmt$(v)}`);
    }
  }
  lines.push(`  Apify:          ${fmt$(apifyDelta)}${apifyCaveat ? ` ⚠ ${apifyCaveat}` : ''}`);
  if (!baseSnap) {
    lines.push('');
    lines.push('💡 Для точного отчёта нужен snapshot на начало периода.');
    lines.push('   Запусти `node tools/spend-report.mjs --snapshot` сегодня — через сутки получишь точную дельту 24h.');
  }
  console.log(lines.join('\n'));
}

// ---------- entry ----------
if (isSnapshotMode) await doSnapshot();
else await doReport();
