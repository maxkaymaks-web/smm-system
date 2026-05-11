#!/usr/bin/env node
/**
 * tg-topic.mjs — управление Telegram-форум-топиками SEO-claw группы.
 *
 * Команды:
 *   create <ProjectID> [name]   создать топик, зарегистрировать в topics.json
 *   init-all                    создать топики для всех проектов без topic_id
 *   list                        показать что в topics.json + проверить группу
 *   id <ProjectID>              вывести thread_id проекта
 *
 * Требует в .env: TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_ID.
 * Бот должен быть админом группы с правом can_manage_topics.
 *
 * Маппинг хранится в projects/topics.json — он закоммичен в git, чтобы все
 * агенты знали в какой топик пушить результаты.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TOPICS_FILE = path.join(ROOT, 'projects/topics.json');

function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function loadTopics() {
  if (!fs.existsSync(TOPICS_FILE)) {
    return { _comment: 'ProjectID → telegram forum thread_id. General = 1.', general: { thread_id: 1, name: 'General' } };
  }
  return JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
}

function saveTopics(t) {
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(t, null, 2) + '\n');
}

async function tg(method, params) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(`${method}: ${d.description ?? r.status}`);
  return d.result;
}

async function createTopic(projectId, name) {
  const chat = process.env.TELEGRAM_GROUP_ID;
  const topics = loadTopics();
  if (topics[projectId]?.thread_id) {
    console.log(`${projectId} уже есть: thread_id=${topics[projectId].thread_id}`);
    return topics[projectId].thread_id;
  }
  const result = await tg('createForumTopic', { chat_id: chat, name: name ?? projectId });
  topics[projectId] = { thread_id: result.message_thread_id, name: result.name };
  saveTopics(topics);
  console.log(`✓ создан ${projectId}: thread_id=${result.message_thread_id} "${result.name}"`);
  return result.message_thread_id;
}

async function initAll() {
  const projDir = path.join(ROOT, 'projects');
  const projects = fs.readdirSync(projDir).filter(d => {
    if (d.startsWith('_') || d.startsWith('.')) return false;
    return fs.statSync(path.join(projDir, d)).isDirectory();
  });
  console.log(`Найдено ${projects.length} проектов`);
  for (const p of projects) {
    await createTopic(p);
  }
}

function list() {
  const topics = loadTopics();
  console.log('ProjectID                        thread_id  Название');
  console.log('───────────────────────────────────────────────────────────');
  for (const [k, v] of Object.entries(topics)) {
    if (k.startsWith('_')) continue;
    console.log(`${k.padEnd(33)} ${String(v.thread_id).padEnd(10)} ${v.name}`);
  }
}

loadEnv();
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'create':
    if (!args[0]) { console.error('usage: tg-topic.mjs create <ProjectID> [name]'); process.exit(1); }
    await createTopic(args[0], args[1]);
    break;
  case 'init-all':
    await initAll();
    break;
  case 'list':
    list();
    break;
  case 'id': {
    const t = loadTopics();
    const id = t[args[0]]?.thread_id;
    if (id == null) { console.error(`нет ${args[0]}`); process.exit(1); }
    console.log(id);
    break;
  }
  default:
    console.error('usage: tg-topic.mjs <create|init-all|list|id> [args]');
    process.exit(1);
}
