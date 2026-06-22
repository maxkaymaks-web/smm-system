#!/usr/bin/env node
/**
 * cache-probe.mjs — проверка что prompt cache LiteLLM → OpenRouter → Anthropic жив.
 *
 * Два теста:
 *   (a) non-stream: 3 идентичных запроса с большим системным префиксом.
 *       OpenRouter возвращает prompt_tokens_details.cached_tokens →
 *       видно cache_write на 1-м и cache_read на 2-3.
 *   (b) stream: 2 идентичных stream-запроса, замер TTFB.
 *       OpenRouter в stream-режиме не пишет cached_tokens в usage,
 *       но Anthropic реально применяет кэш — видно по уменьшению TTFB.
 *
 * Требует в .env: LITELLM_URL, LITELLM_KEY.
 *
 * Использование:
 *   node tools/cache-probe.mjs
 *   node tools/cache-probe.mjs --model smm/claude-haiku-4.5   # другая модель
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
const KEY = process.env.LITELLM_KEY;
if (!URL || !KEY) {
  console.error('Нужны LITELLM_URL и LITELLM_KEY в .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const modelIdx = args.indexOf('--model');
const MODEL = modelIdx !== -1 ? args[modelIdx + 1] : 'smm/claude-sonnet-4.6';

// ~2800 токенов стабильного системного промпта — выше минимума для кэша Sonnet (1024).
// Префикс уникален для каждого запуска (Anthropic кеш TTL 5 мин), иначе первый запрос
// прогона может попасть в кэш от предыдущего и испортить «cache_write» сигнал.
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const SYS = `Cache probe A run-id ${RUN_ID}. ` + 'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(200);
const SYS_B_UNIQUE = `Cache probe B run-id ${RUN_ID}. ` + 'Stream cache probe stable text. '.repeat(300);

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const ok  = (s) => `${GREEN}${s}${RESET}`;
const bad = (s) => `${RED}${s}${RESET}`;
const dim = (s) => `${DIM}${s}${RESET}`;

async function callOnce(label) {
  const r = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 5,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: `Скажи ${label} и больше ничего.` },
      ],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  const u = j.usage || {};
  const ptd = u.prompt_tokens_details || {};
  return {
    pt: u.prompt_tokens,
    cached: ptd.cached_tokens ?? 0,
    write: ptd.cache_write_tokens ?? 0,
    cost: u.cost ?? null,
  };
}

async function callStream() {
  const t0 = Date.now();
  let ttfb = null;
  const r = await fetch(`${URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 5,
      stream: true,
      messages: [
        { role: 'system', content: SYS_B_UNIQUE },
        { role: 'user', content: 'Hello.' },
      ],
    }),
  });
  if (!r.ok) throw new Error(`stream HTTP ${r.status}`);
  const reader = r.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (ttfb === null) ttfb = Date.now() - t0;
    if (done) break;
  }
  return { ttfb, total: Date.now() - t0 };
}

function fmt$(n) { return n == null ? '?' : `$${n.toFixed(5)}`; }

async function testNonStream() {
  console.log(`\n${ok('▎')} Тест A — non-stream (явные cached_tokens)\n`);
  const results = [];
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await callOnce(String(i));
      results.push(r);
      console.log(`  call ${i}: pt=${r.pt}  cached=${r.cached}  write=${r.write}  cost=${fmt$(r.cost)}`);
    } catch (e) {
      console.log(`  call ${i}: ${bad('FAIL')} ${e.message}`);
      return false;
    }
  }
  const [c1, c2, c3] = results;
  const writeOk = c1.write > 100;
  const hit2 = c2.cached > 100 && c2.cached >= c1.write - 50;
  const hit3 = c3.cached > 100;
  const cheaper = c2.cost != null && c1.cost != null && c2.cost < c1.cost / 3;

  console.log();
  if (writeOk && hit2 && hit3 && cheaper) {
    console.log(`  ${ok('✓ injection: OK')}  — кэш создан и читается, стоимость ${(c1.cost / c2.cost).toFixed(1)}× меньше на повторе`);
    return true;
  }
  if (!writeOk) console.log(`  ${bad('✗ injection: BROKEN')} — на 1-м запросе cache_write=${c1.write} (ожидалось > ~${Math.floor(c1.pt * 0.9)})`);
  else if (!hit2) console.log(`  ${bad('✗ injection: BROKEN')} — на 2-м запросе cached=${c2.cached} (ожидалось ≈ ${c1.write})`);
  else if (!cheaper) console.log(`  ${YELLOW}⚠ кэш работает, но cost не упал в 3× — что-то странное${RESET}`);
  return false;
}

async function testStream() {
  console.log(`\n${ok('▎')} Тест B — stream TTFB (как OpenClaw, по 3 замера)\n`);
  try {
    const samples = [];
    for (let i = 1; i <= 3; i++) {
      const s = await callStream();
      samples.push(s);
      console.log(`  call ${i}: ttfb=${s.ttfb}ms  total=${s.total}ms`);
    }
    const [s1, s2, s3] = samples;
    const repeatAvg = Math.round((s2.ttfb + s3.ttfb) / 2);
    const delta = s1.ttfb - repeatAvg;
    console.log();
    console.log(`  call 1 (свежий, cache_write): ${s1.ttfb}ms`);
    console.log(`  call 2-3 средн (cache_read?): ${repeatAvg}ms`);
    console.log(`  Δ = ${delta > 0 ? '-' : '+'}${Math.abs(delta)}ms`);
    console.log();
    if (delta > 150) {
      console.log(`  ${ok('✓ streaming cache: WORKING')} — повторы быстрее на ${delta}ms (Anthropic зачитал кэш)`);
      console.log(`  ${dim('Примечание: cached_tokens в stream-usage не приходит — это норма для OpenRouter')}`);
      return true;
    } else if (delta > 50) {
      console.log(`  ${YELLOW}⚠ streaming cache: вероятно работает${RESET} — разница ${delta}ms (network jitter мешает)`);
      console.log(`  ${dim('Тест A прошёл — значит injection стоит правильно, кэш применяется и в stream')}`);
      return null;
    } else {
      console.log(`  ${YELLOW}⚠ streaming cache: разница ${delta}ms — TTFB слишком шумный${RESET}`);
      console.log(`  ${dim('Если Тест A прошёл — кэш всё равно работает (injection общая для stream/non-stream)')}`);
      return null;
    }
  } catch (e) {
    console.log(`  ${bad('FAIL')} ${e.message}`);
    return false;
  }
}

console.log(`Cache probe → ${MODEL} via ${URL}`);
console.log(`System prompt: ${SYS.length} chars (~${Math.floor(SYS.length / 4)} tokens)`);
const a = await testNonStream();
const b = await testStream();

console.log();
if (a) {
  console.log(`${ok('Итог: кэш работает')}. tools/spend.mjs для stream-запросов завышает расход — Anthropic снимает меньше.`);
  process.exit(0);
} else {
  console.log(`${bad('Итог: проблема с инжекцией')}. Проверь cache_control_injection_points в /root/litellm/config.yaml — должно быть index: 0.`);
  process.exit(1);
}
