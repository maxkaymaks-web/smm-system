#!/usr/bin/env node
/**
 * tg-send.mjs — отправить сообщение в топик проекта.
 *
 * Используется агентами для отчётов: «черновик готов», «опубликовано», и т.п.
 *
 *   tg-send.mjs <ProjectID> --text "сообщение"
 *   tg-send.mjs <ProjectID> --text "..." --photo path/to/post.png
 *   tg-send.mjs <ProjectID> --text "..." --file path/to/post.pdf
 *
 * thread_id берётся из projects/topics.json.
 * Если хочешь в General — передай ProjectID = `general`.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function topicId(projectId) {
  const topics = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects/topics.json'), 'utf8'));
  const t = topics[projectId];
  if (!t) throw new Error(`нет ${projectId} в projects/topics.json — сначала tg-topic.mjs create`);
  return t.thread_id;
}

async function postMultipart(method, fields, fileField, filePath) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  if (fileField && filePath) {
    const buf = fs.readFileSync(filePath);
    form.append(fileField, new Blob([buf]), path.basename(filePath));
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form });
  const d = await r.json();
  if (!d.ok) throw new Error(`${method}: ${d.description ?? r.status}`);
  return d.result;
}

loadEnv();
const args = process.argv.slice(2);
const projectId = args[0];
if (!projectId) { console.error('usage: tg-send.mjs <ProjectID> --text "..." [--photo path | --file path]'); process.exit(1); }

const get = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const text = get('--text');
const photo = get('--photo');
const file = get('--file');

if (!text && !photo && !file) { console.error('нужен --text или --photo или --file'); process.exit(1); }

const chat_id = process.env.TELEGRAM_GROUP_ID;
const thread = topicId(projectId);
const base = { chat_id, message_thread_id: thread };

let res;
if (photo) {
  res = await postMultipart('sendPhoto', { ...base, caption: text ?? '' }, 'photo', photo);
} else if (file) {
  res = await postMultipart('sendDocument', { ...base, caption: text ?? '' }, 'document', file);
} else {
  res = await postMultipart('sendMessage', { ...base, text });
}
console.log(`✓ → ${projectId} (thread ${thread}) msg ${res.message_id}`);
