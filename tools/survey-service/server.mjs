// survey-service — отдаёт форму-бриф клиенту и принимает ответы в S3.
// Паттерн http-сервера — как tools/onboard-service/server.mjs (голый node:http).
//
// Маршруты:
//   GET  /                     → форма (public/index.html)
//   GET  /survey.json          → описание формы (с подстановкой TG оператора)
//   GET  /vendor/*, /*.css|js  → статика
//   POST /submit               → публично: ответ клиента → S3 smm/intake/...
//   GET  /api/intake           → токен: список заявок (key, date, brand)
//   GET  /api/intake/{key}     → токен: одна заявка (вопрос→ответ)
//
// Env: S3_* (хранилище), SURVEY_API_KEY (read-API), OPERATOR_TG, INTAKE_PREFIX, PORT.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { buildIntakeKey, flattenAnswers } from './lib.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');

// .env из корня репо (для локального запуска; на сервере env инжектится снаружи).
(function loadEnv() {
  const p = path.resolve(DIR, '../../.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

const {
  S3_ENDPOINT, S3_BUCKET, S3_REGION = 'ru-1', S3_ACCESS_KEY, S3_SECRET_KEY,
  SURVEY_API_KEY, OPERATOR_TG = '@krMaxim', INTAKE_PREFIX = 'smm/intake/',
  PORT = '4020',
} = process.env;

if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
  console.error('нужны env: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY');
  process.exit(1);
}
if (!SURVEY_API_KEY) {
  console.error('нужен env: SURVEY_API_KEY (токен read-API)');
  process.exit(1);
}

const PREFIX = INTAKE_PREFIX.endsWith('/') ? INTAKE_PREFIX : INTAKE_PREFIX + '/';
const TG_HANDLE = OPERATOR_TG.startsWith('@') ? OPERATOR_TG : '@' + OPERATOR_TG;
const TG_URL = 'https://t.me/' + TG_HANDLE.slice(1);

const s3 = new S3Client({
  endpoint: S3_ENDPOINT, region: S3_REGION, forcePathStyle: true,
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
});

const MAX_BODY = 256 * 1024;          // 256 КБ
const RATE_MAX = 20;                   // сабмитов с одного IP
const RATE_WINDOW = 60 * 60 * 1000;    // за час
const hits = new Map();                // ip → [timestamps]

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
};

const sendJson = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = ''; let aborted = false;
    req.on('data', (c) => {
      if (aborted) return;
      b += c;
      if (b.length > MAX_BODY) { aborted = true; req.destroy(); reject(new Error('too large')); }
    });
    req.on('end', () => { if (!aborted) { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } } });
    req.on('error', reject);
  });
}

async function s3Put(key, body) {
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET, Key: key, Body: body, ContentType: 'application/json',
  });
  try { await s3.send(cmd); } catch (e) { await s3.send(cmd); } // один ретрай
}

async function s3GetJson(key) {
  const r = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  return JSON.parse(await r.Body.transformToString('utf-8'));
}

// бренд из имени файла: {date}-{brand-slug}-{rand}.json
function brandFromKey(key) {
  const name = key.slice(PREFIX.length).replace(/\.json$/, '');
  const m = name.match(/^\d{4}-\d{2}-\d{2}-(.+)-[a-z0-9]+$/);
  return m ? m[1] : name;
}

let surveyDef = null;
function getSurveyDef() {
  if (!surveyDef) surveyDef = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'survey.json'), 'utf8'));
  return surveyDef;
}

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.join(PUBLIC, rel);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  // survey.json — с подстановкой TG оператора
  if (rel === 'survey.json') {
    const txt = fs.readFileSync(full, 'utf8')
      .replaceAll('__OPERATOR_TG_URL__', TG_URL)
      .replaceAll('__OPERATOR_TG__', TG_HANDLE);
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(txt); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { return sendJson(res, 400, { error: 'bad request' }); } // напр. req.url === '//' роняет new URL
  const p = url.pathname;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

  // --- публичный приём ответов ---
  if (req.method === 'POST' && p === '/submit') {
    if (rateLimited(ip)) return sendJson(res, 429, { error: 'too many requests' });
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJson(res, 400, { error: e.message === 'too large' ? 'payload too large' : 'bad json' }); }
    if (body._hp) return sendJson(res, 200, { ok: true }); // honeypot: молча глотаем бота
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : null;
    if (!answers || !answers.q1) return sendJson(res, 400, { error: 'empty submission' });
    const now = new Date();
    const rand = crypto.randomBytes(3).toString('hex');
    const key = buildIntakeKey(PREFIX, answers.q1, now, rand);
    const record = { submittedAt: now.toISOString(), brand: String(answers.q1), answers };
    try {
      await s3Put(key, JSON.stringify(record, null, 2));
    } catch (e) {
      console.error('S3 put failed:', e.message);
      return sendJson(res, 503, { error: 'storage unavailable' });
    }
    console.log(`intake: ${key} (${ip})`);
    return sendJson(res, 200, { ok: true, key });
  }

  // --- защищённый токеном read-API ---
  if (p.startsWith('/api/')) {
    if ((req.headers.authorization || '') !== SURVEY_API_KEY) {
      return sendJson(res, 401, { error: 'unauthorized' });
    }
    if (req.method === 'GET' && p === '/api/intake') {
      const since = url.searchParams.get('since');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 500);
      try {
        const out = [];
        let token;
        do {
          const r = await s3.send(new ListObjectsV2Command({
            Bucket: S3_BUCKET, Prefix: PREFIX, ContinuationToken: token,
          }));
          for (const o of r.Contents || []) {
            if (!o.Key.endsWith('.json')) continue;
            const submittedAt = o.LastModified ? new Date(o.LastModified).toISOString() : null;
            if (since && submittedAt && submittedAt < since) continue;
            out.push({ key: o.Key, brand: brandFromKey(o.Key), submittedAt });
          }
          token = r.IsTruncated ? r.NextContinuationToken : undefined;
        } while (token);
        out.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
        return sendJson(res, 200, { count: out.length, items: out.slice(0, limit) });
      } catch (e) {
        return sendJson(res, 502, { error: 'list failed: ' + e.message });
      }
    }
    if (req.method === 'GET' && p.startsWith('/api/intake/')) {
      const key = decodeURIComponent(p.slice('/api/intake/'.length));
      if (!key.startsWith(PREFIX) || key.includes('..')) return sendJson(res, 400, { error: 'bad key' });
      try {
        const rec = await s3GetJson(key);
        const fields = flattenAnswers(getSurveyDef(), rec.answers);
        return sendJson(res, 200, { key, submittedAt: rec.submittedAt, brand: rec.brand, fields });
      } catch (e) {
        return sendJson(res, 404, { error: 'not found' });
      }
    }
    return sendJson(res, 404, { error: 'unknown endpoint' });
  }

  // --- статика формы ---
  if (req.method === 'GET') return serveStatic(res, p);
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(Number(PORT), () => {
  console.log(`survey-service на :${PORT} · оператор ${TG_HANDLE} · префикс ${PREFIX}`);
});
