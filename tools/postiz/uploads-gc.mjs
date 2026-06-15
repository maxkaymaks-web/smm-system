#!/usr/bin/env node
// Postiz local-uploads garbage collector.
//
// Postiz (STORAGE_PROVIDER=local) складывает загруженные картинки/видео в
// docker-volume postiz-uploads → /uploads/ГГГГ/ММ/ДД/<hex>.<ext> и НИКОГДА их
// сам не удаляет (removeFile дёргается не во всех флоу, авто-TTL нет). Volume
// durable (переживает рестарт контейнера и ребут сервера) → файлы копятся вечно.
//
// Этот скрипт удаляет старые файлы БЕЗОПАСНО:
//   удаляем файл, если он старше RETENTION дней (mtime ≈ дата загрузки)
//   И на него НЕ ссылается живой пост в статусе QUEUE/DRAFT либо с publishDate
//   в будущем (keep-set из БД). После публикации в VK/TG локальная копия не нужна.
// Плюс: soft-delete осиротевших строк Media (файл удалён/отсутствует), чтобы в
// медиа-библиотеке Postiz не висели битые превью.
//
// Запускается НА ХОСТЕ Postiz (нужен доступ к volume + контейнеру postiz-postgres).
// По умолчанию dry-run. Реальное удаление — только с флагом --apply.
//
//   node uploads-gc.mjs               # показать что удалил бы
//   node uploads-gc.mjs --days 30     # другой срок хранения
//   node uploads-gc.mjs --apply       # реально удалить + почистить БД
//
// Переопределяемое окружением (дефолты под наш сервер):
//   GC_DATA   путь к данным volume   (/var/lib/docker/volumes/postiz-official_postiz-uploads/_data)
//   GC_PG     имя контейнера Postgres (postiz-postgres)
//   GC_PGUSER / GC_PGDB              (postiz-user / postiz-db-local)

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const argOf = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};

const DAYS = Number(process.env.GC_DAYS || argOf('--days') || 30);
const APPLY = process.argv.includes('--apply');
const DATA = process.env.GC_DATA || '/var/lib/docker/volumes/postiz-official_postiz-uploads/_data';
const PG = process.env.GC_PG || 'postiz-postgres';
const PGUSER = process.env.GC_PGUSER || 'postiz-user';
const PGDB = process.env.GC_PGDB || 'postiz-db-local';

const cutoffMs = Date.now() - DAYS * 86_400_000;
const UPLOAD_RE = /\/uploads\/[0-9]{4}\/[0-9]{2}\/[0-9]{2}\/[0-9a-fA-F]+\.[a-z0-9]+/g;

const psql = (sql) =>
  execFileSync('docker', ['exec', PG, 'psql', '-U', PGUSER, '-d', PGDB, '-tAc', sql], {
    encoding: 'utf8',
  });

const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

// ── 1. keep-set: файлы, которые ещё нужны (не удалять ни при каком возрасте) ──
//    живой пост в очереди/черновике ИЛИ запланированный в будущем.
const keepRaw = psql(
  `select coalesce(image,'') || ' ' || coalesce(content,'') from "Post" ` +
    `where "deletedAt" is null and (state in ('QUEUE','DRAFT') or "publishDate" > now())`,
);
const KEEP = new Set();
for (const m of keepRaw.matchAll(UPLOAD_RE)) KEEP.add(m[0]);

// ── 2. обход volume ──
const toDelete = [];
let scanned = 0;
let tooFresh = 0;
let protectedByPost = 0;

const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!e.isFile()) continue;
    scanned++;
    const rel = '/uploads/' + relative(DATA, p);
    const st = statSync(p);
    if (st.mtimeMs >= cutoffMs) {
      tooFresh++;
      continue;
    }
    if (KEEP.has(rel)) {
      protectedByPost++;
      continue;
    }
    toDelete.push({ p, rel, size: st.size });
  }
};

if (existsSync(DATA)) walk(DATA);
else console.warn(`⚠  volume data dir не найден: ${DATA}`);

const freed = toDelete.reduce((a, f) => a + f.size, 0);

// ── удаление файлов ──
for (const f of toDelete) {
  if (APPLY) unlinkSync(f.p);
}

// ── чистка пустых каталогов дат ──
let dirsRemoved = 0;
const pruneEmpty = (dir) => {
  if (!existsSync(dir)) return true;
  let empty = true;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const childEmpty = pruneEmpty(join(dir, e.name));
      if (!childEmpty) empty = false;
    } else {
      empty = false;
    }
  }
  if (empty && dir !== DATA) {
    if (APPLY) {
      rmdirSync(dir);
      dirsRemoved++;
    } else {
      dirsRemoved++;
    }
    return true;
  }
  return empty;
};
pruneEmpty(DATA);

// ── 3. soft-delete осиротевших строк Media (файл отсутствует, старше cutoff, не в keep) ──
const mediaRaw = psql(
  `select id || E'\\t' || coalesce(path,'') from "Media" where "deletedAt" is null`,
);
const orphanIds = [];
for (const line of mediaRaw.split('\n')) {
  if (!line.trim()) continue;
  const [id, path] = line.split('\t');
  const m = path && path.match(UPLOAD_RE);
  if (!m) continue;
  const rel = m[0];
  if (KEEP.has(rel)) continue;
  const abs = join(DATA, rel.replace(/^\/uploads\//, ''));
  if (existsSync(abs)) continue; // файл на месте — строку не трогаем
  orphanIds.push(id);
}
if (orphanIds.length && APPLY) {
  const list = orphanIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
  psql(`update "Media" set "deletedAt"=now() where id in (${list})`);
}

// ── отчёт ──
const mode = APPLY ? 'APPLY' : 'DRY-RUN';
const ts = new Date().toISOString();
console.log(
  `[${ts}] postiz-uploads-gc ${mode} retention=${DAYS}d | ` +
    `scanned=${scanned} fresh=${tooFresh} protected=${protectedByPost} ` +
    `deleted=${toDelete.length} freed=${fmtSize(freed)} ` +
    `emptyDirs=${dirsRemoved} mediaOrphansPruned=${orphanIds.length}`,
);
if (!APPLY && (toDelete.length || orphanIds.length)) {
  for (const f of toDelete.slice(0, 20)) console.log(`  would delete  ${f.rel} (${fmtSize(f.size)})`);
  if (toDelete.length > 20) console.log(`  … +${toDelete.length - 20} more files`);
  if (orphanIds.length) console.log(`  would soft-delete Media rows: ${orphanIds.length}`);
  console.log('  (dry-run — ничего не удалено; добавь --apply)');
}
