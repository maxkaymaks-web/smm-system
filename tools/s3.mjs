#!/usr/bin/env node
/**
 * s3.mjs — CLI для S3 (Timeweb Cloud, bucket=seo).
 *
 * Команды:
 *   list [prefix]                      список ключей по префиксу
 *   put <local> <s3-key>               загрузить один файл
 *   get <s3-key> <local>               скачать один файл
 *   rm <s3-key>                        удалить (поддерживает префикс с --recursive)
 *   sync-up <local-dir> [s3-prefix]    загрузить директорию рекурсивно
 *   sync-down <s3-prefix> <local-dir>  скачать префикс в директорию
 *   url <s3-key> [ttl=3600]            presigned URL для просмотра/расшаривания
 *   exists <s3-key>                    проверить наличие
 *
 * Ключ в S3 ОБЫЧНО = относительному пути от корня репо.
 * Пример: projects/X/posts/drafts/.../slide_01.png → s3://seo/projects/X/posts/drafts/.../slide_01.png
 *
 * Креды и endpoint — из .env (S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY).
 */

import fs from 'node:fs';
import path from 'node:path';
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

const BUCKET = process.env.S3_BUCKET;
if (!process.env.S3_ENDPOINT || !BUCKET) {
  console.error('S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY должны быть в .env');
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

async function list(prefix = '') {
  let token, total = 0, bytes = 0;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of r.Contents ?? []) {
      const size = o.Size;
      const human = size >= 1e6 ? `${(size / 1e6).toFixed(1)}M` : size >= 1e3 ? `${(size / 1e3).toFixed(1)}K` : `${size}B`;
      console.log(`${human.padStart(8)}  ${o.LastModified.toISOString().slice(0, 19)}  ${o.Key}`);
      total++; bytes += size;
    }
    token = r.IsTruncated ? r.NextContinuationToken : null;
  } while (token);
  console.error(`──\n${total} объектов, ${(bytes / 1e6).toFixed(1)} MB`);
}

async function exists(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function put(local, key) {
  const stat = fs.statSync(local);
  const body = fs.createReadStream(local);
  const upload = new Upload({ client: s3, params: { Bucket: BUCKET, Key: key, Body: body }, queueSize: 4, partSize: 8 * 1024 * 1024 });
  await upload.done();
  console.log(`✓ put ${key} (${(stat.size / 1e6).toFixed(1)} MB)`);
}

async function get(key, local) {
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  fs.mkdirSync(path.dirname(local), { recursive: true });
  await new Promise((res, rej) => r.Body.pipe(fs.createWriteStream(local)).on('finish', res).on('error', rej));
  console.log(`✓ get ${key} → ${local}`);
}

async function rm(key, recursive = false) {
  if (!recursive) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    console.log(`✓ rm ${key}`);
    return;
  }
  let token, total = 0;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: key, ContinuationToken: token, MaxKeys: 1000 }));
    const keys = (r.Contents ?? []).map(o => ({ Key: o.Key }));
    if (keys.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } }));
      total += keys.length;
    }
    token = r.IsTruncated ? r.NextContinuationToken : null;
  } while (token);
  console.log(`✓ rm -r ${key} (${total} объектов)`);
}

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else if (e.isFile()) out.push({ local: p, rel: path.relative(base, p) });
  }
  return out;
}

async function syncUp(localDir, prefix) {
  if (!fs.existsSync(localDir)) { console.error(`нет ${localDir}`); process.exit(1); }
  const cleanPrefix = (prefix ?? localDir).replace(/\/$/, '');
  const files = walk(localDir);
  console.error(`загружаю ${files.length} файлов в ${cleanPrefix}/`);
  let done = 0;
  for (const f of files) {
    const key = `${cleanPrefix}/${f.rel}`.replace(/\\/g, '/');
    await put(f.local, key);
    done++;
    if (done % 20 === 0) console.error(`  ${done}/${files.length}`);
  }
}

async function syncDown(prefix, localDir) {
  fs.mkdirSync(localDir, { recursive: true });
  let token, total = 0;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of r.Contents ?? []) {
      const rel = o.Key.startsWith(prefix) ? o.Key.slice(prefix.length).replace(/^\//, '') : o.Key;
      await get(o.Key, path.join(localDir, rel));
      total++;
    }
    token = r.IsTruncated ? r.NextContinuationToken : null;
  } while (token);
  console.error(`✓ скачано ${total} объектов в ${localDir}`);
}

async function url(key, ttl) {
  const u = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: ttl });
  console.log(u);
}

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'list':       await list(args[0] ?? ''); break;
    case 'put':        if (!args[1]) throw new Error('put <local> <s3-key>'); await put(args[0], args[1]); break;
    case 'get':        if (!args[1]) throw new Error('get <s3-key> <local>'); await get(args[0], args[1]); break;
    case 'rm':         if (!args[0]) throw new Error('rm <key> [--recursive]'); await rm(args[0], args.includes('--recursive') || args.includes('-r')); break;
    case 'sync-up':    if (!args[0]) throw new Error('sync-up <local-dir> [s3-prefix]'); await syncUp(args[0], args[1]); break;
    case 'sync-down':  if (!args[1]) throw new Error('sync-down <s3-prefix> <local-dir>'); await syncDown(args[0], args[1]); break;
    case 'url':        if (!args[0]) throw new Error('url <key> [ttl-sec]'); await url(args[0], Number(args[1] ?? 3600)); break;
    case 'exists':     console.log(await exists(args[0])); break;
    default:
      console.error('usage: s3.mjs <list|put|get|rm|sync-up|sync-down|url|exists> [args]');
      process.exit(1);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
