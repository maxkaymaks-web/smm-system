#!/usr/bin/env node
/**
 * openclaw-logs-sync.mjs — выгрузка session-логов OpenClaw в S3.
 *
 * Запускается на сервере (5.42.117.201) по cron'у в 03:00 ежедневно.
 * Читает /root/.openclaw/agents/main/sessions/ и копирует *.jsonl /
 * *.trajectory.jsonl / *.trajectory-path.json / *.reset.* в S3 под ключ
 *   logs/openclaw/{YYYY}/{MM}/{DD}/{filename}
 * где YYYY/MM/DD — дата ПЕРВОГО event'а сессии (timestamp из первой строки),
 * чтобы все файлы одной сессии группировались под её датой рождения.
 *
 * Идемпотентно: для каждого файла сравнивает size+mtime с HEAD object'ом
 * в S3 (метадата x-amz-meta-srcmtime / srcsize). Если совпадает — скип.
 * Активные (растущие) сессии будут перезаливаться, S3 PUT идемпотентен.
 *
 * Также кладёт текущий /root/.openclaw/agents/main/sessions/sessions.json
 * под logs/openclaw/_index/sessions-{YYYY-MM-DD}.json (снимок на момент запуска).
 *
 * Флаги:
 *   --dry-run         только показать, что было бы залито, без PUT
 *   --since <days>    обрабатывать файлы с mtime не старше N дней (default: 60)
 *   --src <dir>       исходная папка (default: /root/.openclaw/agents/main/sessions)
 *   --prefix <p>      S3-префикс (default: logs/openclaw)
 */

import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const ROOT = process.cwd();

function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const SINCE_DAYS = Number(args[args.indexOf('--since') + 1]) || 60;
const SRC = args.includes('--src') ? args[args.indexOf('--src') + 1] : '/root/.openclaw/agents/main/sessions';
const PREFIX = (args.includes('--prefix') ? args[args.indexOf('--prefix') + 1] : 'logs/openclaw').replace(/\/$/, '');

const BUCKET = process.env.S3_BUCKET;
if (!process.env.S3_ENDPOINT || !BUCKET) {
  console.error('S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY должны быть в .env');
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error(`нет ${SRC}`);
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'ru-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

function firstEventDate(filePath) {
  // Берём timestamp из первой строки JSONL — это создание сессии.
  // Если нечитаемо — fallback на mtime.
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    const firstLine = buf.toString('utf8').split('\n')[0];
    const j = JSON.parse(firstLine);
    const ts = j.timestamp ?? j.ts;
    if (ts) return new Date(ts);
  } catch {}
  return fs.statSync(filePath).mtime;
}

function datePartition(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

// session-id по имени файла: {uuid} или {uuid}-topic-{N}, плюс возможные суффиксы
// .trajectory.jsonl / .trajectory-path.json / .jsonl.reset.{iso}
function sessionStem(filename) {
  return filename
    .replace(/\.trajectory\.jsonl$/, '')
    .replace(/\.trajectory-path\.json$/, '')
    .replace(/\.jsonl\.reset\..*$/, '')
    .replace(/\.jsonl$/, '');
}

async function headMeta(key) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { size: r.ContentLength, meta: r.Metadata ?? {} };
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return null;
    throw e;
  }
}

async function putFile(local, key, srcMtimeMs, srcSize) {
  const body = fs.readFileSync(local);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    Metadata: {
      srcmtime: String(Math.floor(srcMtimeMs)),
      srcsize: String(srcSize),
    },
  }));
}

async function main() {
  const cutoffMs = Date.now() - SINCE_DAYS * 24 * 3600 * 1000;
  const entries = fs.readdirSync(SRC, { withFileTypes: true })
    .filter(e => e.isFile())
    .map(e => {
      const local = path.join(SRC, e.name);
      const st = fs.statSync(local);
      return { name: e.name, local, size: st.size, mtimeMs: st.mtimeMs };
    })
    .filter(f => f.mtimeMs >= cutoffMs);

  // Группируем по сессии, дата = первый event первого файла сессии.
  const bySession = new Map();
  for (const f of entries) {
    const stem = sessionStem(f.name);
    if (!bySession.has(stem)) bySession.set(stem, []);
    bySession.get(stem).push(f);
  }

  let uploaded = 0, skipped = 0, bytes = 0, sessionCount = 0;
  for (const [stem, files] of bySession) {
    sessionCount++;
    // Дату партиции выбираем по самому раннему первому event'у среди файлов сессии
    const dates = files.map(f => firstEventDate(f.local));
    const partition = datePartition(new Date(Math.min(...dates.map(d => +d))));

    for (const f of files) {
      const key = `${PREFIX}/${partition}/${f.name}`;
      const head = await headMeta(key);
      const same = head
        && head.size === f.size
        && Number(head.meta?.srcmtime) === Math.floor(f.mtimeMs);
      if (same) {
        skipped++;
        continue;
      }
      const tag = head ? 'update' : 'new   ';
      console.log(`${DRY ? 'DRY' : '   '} ${tag}  ${key}  (${(f.size / 1024).toFixed(1)} KB)`);
      if (!DRY) await putFile(f.local, key, f.mtimeMs, f.size);
      uploaded++;
      bytes += f.size;
    }
  }

  // Index snapshot — текущий sessions.json как ежедневный снимок.
  const idxLocal = path.join(SRC, 'sessions.json');
  if (fs.existsSync(idxLocal)) {
    const today = new Date();
    const ymd = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const idxKey = `${PREFIX}/_index/sessions-${ymd}.json`;
    console.log(`${DRY ? 'DRY' : '   '} snap    ${idxKey}`);
    if (!DRY) {
      const st = fs.statSync(idxLocal);
      await putFile(idxLocal, idxKey, st.mtimeMs, st.size);
    }
  }

  console.log('──');
  console.log(`sessions=${sessionCount}  files=${entries.length}  uploaded=${uploaded}  skipped=${skipped}  bytes=${(bytes / 1e6).toFixed(2)}M  dry=${DRY}`);
}

main().catch(e => { console.error(e); process.exit(1); });
