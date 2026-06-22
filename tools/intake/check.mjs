#!/usr/bin/env node
// check.mjs — забрать заявки из формы-брифа по read-API (токеном).
// Хранилище и S3-креды у оператора не нужны — только SURVEY_API_URL + SURVEY_API_KEY.
//
//   node tools/intake/check.mjs                 список заявок (свежие сверху)
//   node tools/intake/check.mjs --since 2026-06-20   только после даты/ISO
//   node tools/intake/check.mjs --get <key>     одна заявка целиком (вопрос→ответ)
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = process.cwd();
(function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
  // API — наш РФ-домен напрямую, прокси из env тут только мешает.
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) delete process.env[k];
})();

const BASE = (process.env.SURVEY_API_URL || '').replace(/\/+$/, '');
const KEY = process.env.SURVEY_API_KEY;
if (!BASE || !KEY) {
  console.error('✗ нужны SURVEY_API_URL и SURVEY_API_KEY в .env');
  process.exit(1);
}

const { values } = parseArgs({ options: {
  get: { type: 'string' }, since: { type: 'string' },
} });

async function api(pathname) {
  const res = await fetch(BASE + pathname, { headers: { Authorization: KEY } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

(async () => {
  if (values.get) {
    const r = await api('/api/intake/' + encodeURIComponent(values.get));
    console.log(`\n📋 ${r.brand}  ·  ${r.submittedAt}\n${'─'.repeat(50)}`);
    for (const f of r.fields) console.log(`\n▸ ${f.title}\n  ${f.answer.replace(/\n/g, '\n  ')}`);
    console.log('');
    return;
  }
  const q = values.since ? `?since=${encodeURIComponent(values.since)}` : '';
  const r = await api('/api/intake' + q);
  if (!r.count) { console.log('Заявок нет.'); return; }
  console.log(`\nЗаявок: ${r.count}\n`);
  for (const it of r.items) {
    console.log(`  ${it.submittedAt?.slice(0, 16).replace('T', ' ') || '—'}  ${it.brand}`);
    console.log(`      ${it.key}`);
  }
  console.log(`\nОдну целиком:  node tools/intake/check.mjs --get <key>\n`);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
