#!/usr/bin/env node
/**
 * migrate-to-s3.mjs — одноразовый: переносит проектные бинарники + HTML
 * в S3 и удаляет локально.
 *
 *   node tools/migrate-to-s3.mjs --dry-run     # только показать что мигрировать
 *   node tools/migrate-to-s3.mjs               # реально загрузить
 *   node tools/migrate-to-s3.mjs --delete      # после успешной загрузки удалить локально
 *
 * Что мигрирует:
 *   projects/{X}/posts/**           — все типы: html, png, jpg, jpeg, pdf, mp4, webp
 *   projects/{X}/assets/images/**   — клиентские фото-референсы
 *
 * Что НЕ трогает:
 *   projects/{X}/{context,voice,strategy,content-plan,orchestrator}.md  ← текст
 *   projects/{X}/posts/**\/*.md     ← тексты постов
 *   projects/{X}/analytics/**       ← текст
 *   projects/{X}/feedback/**        ← текст
 *   projects/{X}/assets/brand/**    ← шрифты и логотипы (build-deps для рендера HTML)
 *   projects/_template/**           ← эталон файловой структуры
 *   .gitkeep                        ← маркеры пустых директорий
 *
 * S3 key = относительному пути от корня репо.
 */

import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const DELETE = ARGS.includes('--delete');

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
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'ru-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

const BINARY_EXT = new Set(['html', 'png', 'jpg', 'jpeg', 'pdf', 'mp4', 'webp', 'eps', 'ai', 'psd', 'gif', 'svg']);

function shouldMigrate(rel) {
  if (rel.includes('_template/')) return false;
  if (rel.endsWith('.gitkeep')) return false;
  if (rel.endsWith('.md') || rel.endsWith('.json')) return false;
  if (!rel.startsWith('projects/')) return false;

  // только posts/ и assets/images/
  const seg = rel.split('/');
  if (seg.length < 3) return false;
  const [, , sub] = seg;
  if (sub === 'posts') return true;
  if (sub === 'assets' && seg[3] === 'images') return true;

  return false;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

async function exists(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function upload(local, key) {
  const body = fs.createReadStream(local);
  const u = new Upload({ client: s3, params: { Bucket: BUCKET, Key: key, Body: body }, queueSize: 4, partSize: 8 * 1024 * 1024 });
  await u.done();
}

const files = walk(path.join(ROOT, 'projects'))
  .map(f => ({ local: f, rel: path.relative(ROOT, f) }))
  .filter(f => shouldMigrate(f.rel))
  .map(f => ({ ...f, size: fs.statSync(f.local).size }));

const totalBytes = files.reduce((a, f) => a + f.size, 0);

console.log(`Найдено ${files.length} файлов, ${(totalBytes / 1e6).toFixed(1)} MB к миграции\n`);
const byProject = new Map();
for (const f of files) {
  const proj = f.rel.split('/')[1];
  const cur = byProject.get(proj) ?? { count: 0, bytes: 0 };
  cur.count++; cur.bytes += f.size;
  byProject.set(proj, cur);
}
for (const [p, s] of [...byProject.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${p.padEnd(35)} ${String(s.count).padStart(4)} файлов  ${(s.bytes / 1e6).toFixed(1).padStart(7)} MB`);
}

if (DRY) {
  console.log('\n--dry-run: ничего не загружено.');
  process.exit(0);
}

console.log('\nЗагрузка в S3...');
let done = 0, skipped = 0, uploaded = 0;
for (const f of files) {
  const key = f.rel; // mirror path
  if (await exists(key)) {
    skipped++;
    process.stdout.write(`  ${++done}/${files.length} skip exists  ${key}\n`);
  } else {
    await upload(f.local, key);
    uploaded++;
    process.stdout.write(`  ${++done}/${files.length} put          ${key} (${(f.size / 1e6).toFixed(2)}M)\n`);
  }
}

console.log(`\n✓ uploaded ${uploaded}, skipped (already in S3) ${skipped}`);

if (DELETE) {
  console.log('\nУдаление локальных копий после успешной загрузки...');
  let removedFiles = 0;
  const dirsToCheck = new Set();
  for (const f of files) {
    fs.unlinkSync(f.local);
    removedFiles++;
    dirsToCheck.add(path.dirname(f.local));
  }
  // удалить пустые родительские директории
  let removedDirs = 0;
  const sortedDirs = [...dirsToCheck].sort((a, b) => b.length - a.length);
  for (const d of sortedDirs) {
    let cur = d;
    while (cur && cur !== ROOT && fs.existsSync(cur)) {
      const entries = fs.readdirSync(cur);
      if (entries.length === 0) {
        fs.rmdirSync(cur);
        removedDirs++;
        cur = path.dirname(cur);
      } else break;
    }
  }
  console.log(`✓ удалено локально: ${removedFiles} файлов, ${removedDirs} пустых директорий`);
}
