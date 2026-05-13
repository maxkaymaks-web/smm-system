#!/usr/bin/env node
/**
 * spend-report.mjs — расход проекта за период.
 *
 * Источники:
 *   • LiteLLM /spend/logs (ADMIN_KEY) или /key/info fallback — LLM-вызовы smm-openclaw
 *   • Apify /v2/users/me/usage/monthly — cumulative по биллинг-циклу
 *   • state/fal-spend.jsonl — каждый fal-вызов с точным временем
 *
 * Дельты считаются через snapshot'ы в state/spend-snapshots.jsonl (Apify fallback).
 * Snapshot пишется автоматически в конце каждого доReport() + явно через --snapshot.
 *
 * Использование:
 *   node tools/spend-report.mjs --snapshot            # записать snapshot вручную
 *   node tools/spend-report.mjs --period 24h          # дневной отчёт
 *   node tools/spend-report.mjs --period 7d           # неделя
 *   node tools/spend-report.mjs --period 30d          # 30 дней
 *   node tools/spend-report.mjs --period month        # текущий календарный месяц
 *   node tools/spend-report.mjs --from 2026-05-01 --to 2026-05-10
 *   node tools/spend-report.mjs --period 24h --tg     # HTML для Telegram
 *   node tools/spend-report.mjs --period 24h --json   # JSON для daily_briefing.py
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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
const LITELLM_ADMIN_KEY = process.env.LITELLM_ADMIN_KEY;
const APIFY_TOKEN = process.env.APIFY_TOKEN;

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (n) => args.indexOf(n) !== -1;
const val = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };

const isSnapshotMode = flag('--snapshot');
const wantJson = flag('--json');
const wantTg = flag('--tg');
const period = val('--period');
const from = val('--from');
const to = val('--to');

// ---------- period -> {fromTs, toTs, label} ----------
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
      return { fromTs: start, toTs: now, label: `${start.toISOString().slice(0, 7)} (текущий месяц)` };
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
      max_budget:     info.max_budget ?? null,
      budget_reset_at: info.budget_reset_at ?? null,
    };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

// Exact LLM delta via PostgreSQL (SSH → docker exec psql на прокси)
function fetchLitellmLogsDelta(fromTs, toTs) {
  if (!LITELLM_KEY) return null;
  const keyHash = createHash('sha256').update(LITELLM_KEY).digest('hex');
  const since = fromTs.toISOString().replace('T', ' ').slice(0, 23);
  const until = toTs.toISOString().replace('T', ' ').slice(0, 23);
  const sql = `SELECT COALESCE(sum(spend),0) FROM "LiteLLM_SpendLogs" WHERE "api_key"='${keyHash}' AND "startTime">='${since}' AND "startTime"<='${until}';`;
  const cmd = `docker exec litellm-postgres psql -U litellm litellm -t -A -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
  try {
    const r = spawnSync('ssh', ['-p', '24822', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', 'root@5.2.66.188', cmd], {
      encoding: 'utf8', timeout: 15_000,
    });
    if (r.status !== 0) return null;
    const val = parseFloat(r.stdout.trim());
    return isNaN(val) ? null : +val.toFixed(6);
  } catch {
    return null;
  }
}

async function fetchApify() {
  if (!APIFY_TOKEN) return { available: false, reason: 'no APIFY_TOKEN' };
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${APIFY_TOKEN}`);
    if (!r.ok) return { available: false, reason: `HTTP ${r.status}` };
    const d = await r.json();
    const data = d.data ?? {};
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

// ---------- snapshot mode ----------
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
    console.log('✓ snapshot сохранён');
    console.log('  ts:     ', snap.ts);
    console.log('  litellm:', snap.litellm_cumulative_usd ?? '(unavailable)');
    console.log('  apify:  ', snap.apify_cumulative_usd ?? '(unavailable)');
    console.log('  fal:    ', snap.fal_cumulative_usd);
  }
}

// ---------- formatters ----------
function fmt$(n) {
  if (n == null) return '—';
  if (n === 0)   return '$0.00';
  if (n < 0.005) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatPlain(data) {
  const { period, total_usd, sources, caveats } = data;
  const { litellm, apify, fal } = sources;
  const lines = [];

  lines.push(`💸 Расход — ${period.label}`);
  lines.push(`Итого: ${fmt$(total_usd)}`);
  lines.push('');

  lines.push(`🤖 LLM: ${fmt$(litellm.usd)}`);
  if (litellm.budget) {
    const pct = litellm.cumulative_now != null
      ? (litellm.cumulative_now / litellm.budget * 100).toFixed(0) : '?';
    lines.push(`   из $${litellm.budget} цикла (${pct}%)`);
  }

  lines.push(`🎨 fal.ai: ${fmt$(fal.usd)} (${fal.calls} вызов${fal.calls === 1 ? '' : 'ов'})`);
  if (Object.keys(fal.by_model).length) {
    for (const [m, v] of Object.entries(fal.by_model))
      lines.push(`   · ${m}: ${fmt$(v)}`);
  }

  lines.push(`🕷 Apify: ${fmt$(apify.usd)}`);

  if (caveats.length) {
    lines.push('');
    for (const c of caveats) lines.push(`⚠️ ${c}`);
  }

  return lines.join('\n');
}

function formatTg(data) {
  const { period, total_usd, sources, caveats } = data;
  const { litellm, apify, fal } = sources;

  const b = (s) => `<b>${s}</b>`;
  const $n = (n) => fmt$(n);

  const lines = [];
  lines.push(`💸 ${b('Расход — ' + period.label)}`);
  lines.push('');
  lines.push(`Итого: ${b($n(total_usd))}`);
  lines.push('');

  lines.push(`🤖 LLM · ${b($n(litellm.usd))}`);
  if (litellm.budget) {
    const pct = litellm.cumulative_now != null
      ? (litellm.cumulative_now / litellm.budget * 100).toFixed(0) : '?';
    lines.push(`из $${litellm.budget} цикла · ${pct}%`);
  }
  if (litellm.caveat) lines.push(`⚠️ ${litellm.caveat}`);

  lines.push('');
  const falLine = `🎨 fal.ai · ${b($n(fal.usd))}`;
  lines.push(fal.calls > 0 ? `${falLine} · ${fal.calls} вызов${fal.calls === 1 ? '' : 'ов'}` : falLine);
  if (Object.keys(fal.by_model).length) {
    for (const [m, v] of Object.entries(fal.by_model))
      lines.push(`· ${m} · ${$n(v)}`);
  }

  lines.push('');
  lines.push(`🕷 Apify · ${b($n(apify.usd))}`);
  if (apify.caveat) lines.push(`⚠️ ${apify.caveat}`);

  if (caveats.length) {
    lines.push('');
    for (const c of caveats) lines.push(`⚠️ ${c}`);
  }

  return lines.join('\n');
}

// ---------- report mode ----------
async function doReport() {
  const { fromTs, toTs, label } = resolvePeriod();
  const llmLogsDelta = fetchLitellmLogsDelta(fromTs, toTs);
  const [litellm, apify] = await Promise.all([fetchLitellm(), fetchApify()]);
  const fal = fetchFal(fromTs, toTs);
  const baseSnap = findSnapshotAt(fromTs);

  // LiteLLM delta: prefer /spend/logs (exact), fall back to snapshot diff
  let llmDelta = null;
  let llmCaveat = null;
  let llmSource = 'snapshot';

  if (llmLogsDelta !== null) {
    llmDelta = llmLogsDelta;
    llmSource = 'logs';
  } else if (litellm.available) {
    if (baseSnap && baseSnap.litellm_cumulative_usd != null) {
      llmDelta = litellm.cumulative_usd - baseSnap.litellm_cumulative_usd;
      if (llmDelta < 0) {
        llmCaveat = 'бюджет ключа сбрасывался в периоде — оценка занижена';
        llmDelta = litellm.cumulative_usd;
      }
    } else {
      llmCaveat = 'нет snapshot — cumulative с момента последнего reset';
      llmDelta = litellm.cumulative_usd;
    }
  }

  // Apify delta
  let apifyDelta = null;
  let apifyCaveat = null;
  if (apify.available) {
    if (baseSnap && baseSnap.apify_cumulative_usd != null) {
      apifyDelta = apify.cumulative_usd - baseSnap.apify_cumulative_usd;
      if (apifyDelta < 0) {
        apifyCaveat = `цикл Apify reset'нулся в периоде (start: ${apify.cycle_start?.slice(0, 10)})`;
        apifyDelta = apify.cumulative_usd;
      }
    } else {
      apifyCaveat = 'нет snapshot — показываю весь текущий цикл';
      apifyDelta = apify.cumulative_usd;
    }
  }

  const totalUsd = (llmDelta ?? 0) + (apifyDelta ?? 0) + fal.period_usd;

  const globalCaveats = [];
  if (!baseSnap && llmSource !== 'logs') {
    globalCaveats.push('Для точных дельт нужен ежедневный snapshot (см. setup-cron.sh)');
  }

  const out = {
    period: {
      from: fromTs.toISOString(),
      to: toTs.toISOString(),
      label,
      baseline_snapshot_at: baseSnap?.ts ?? null,
      llm_source: llmSource,
    },
    total_usd: +totalUsd.toFixed(4),
    sources: {
      litellm: litellm.available
        ? { usd: llmDelta == null ? null : +llmDelta.toFixed(4), cumulative_now: litellm.cumulative_usd, budget: litellm.max_budget, caveat: llmCaveat }
        : { available: false, reason: litellm.reason },
      apify: apify.available
        ? { usd: apifyDelta == null ? null : +apifyDelta.toFixed(4), cumulative_now: apify.cumulative_usd, cycle: { start: apify.cycle_start, end: apify.cycle_end }, caveat: apifyCaveat }
        : { available: false, reason: apify.reason },
      fal: { usd: fal.period_usd, calls: fal.calls, unknown_priced_calls: fal.unknown_priced_calls, by_model: fal.by_model },
    },
    caveats: globalCaveats,
  };

  if (wantJson) { console.log(JSON.stringify(out, null, 2)); }
  else {
    // Flatten for formatters
    const data = {
      period: out.period,
      total_usd: out.total_usd,
      sources: {
        litellm: { usd: out.sources.litellm.usd, budget: out.sources.litellm.budget, cumulative_now: out.sources.litellm.cumulative_now, caveat: llmCaveat },
        apify:   { usd: out.sources.apify.usd, caveat: apifyCaveat },
        fal:     out.sources.fal,
      },
      caveats: globalCaveats,
    };
    console.log(wantTg ? formatTg(data) : formatPlain(data));
  }

  // Auto-snapshot: write current values so next report has a baseline
  const snap = {
    ts: new Date().toISOString(),
    litellm_cumulative_usd: litellm.available ? litellm.cumulative_usd : null,
    apify_cumulative_usd:   apify.available   ? apify.cumulative_usd   : null,
    fal_cumulative_usd:     fetchFalCumulative(),
    auto: true,
  };
  appendSnapshot(snap);
}

// ---------- entry ----------
if (isSnapshotMode) await doSnapshot();
else await doReport();
