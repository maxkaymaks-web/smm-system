#!/usr/bin/env node
// Завести клиента: скелет projects/{id}/ + карточка Notion + channels.json.
// Идемпотентно: повторный запуск не дублирует.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  loadNotionConfig, findClientByProjectId, createClient, createPlan, pageUrl,
} from '../lib/notion.mjs';

const ROOT = process.cwd();
const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    name: { type: 'string' },
    platforms: { type: 'string' },          // "VK,Telegram"
    operator: { type: 'string', default: '' },
    focus: { type: 'string', default: '' },
    'no-plan': { type: 'boolean', default: false },
  },
});

function die(msg) { console.error('✗ ' + msg); process.exit(1); }

const id = values.id;
const name = values.name;
if (!id || !name) die('нужны --id и --name. Пример: --id BeautyCulture --name "Beauty Culture" --platforms VK,Telegram');
if (!/^[A-Za-z0-9_]+$/.test(id)) die('--id: транслит без пробелов, только [A-Za-z0-9_]');
const platforms = (values.platforms || '').split(',').map((s) => s.trim()).filter(Boolean);

(async () => {
  // 1. Скелет проекта
  const projDir = path.join(ROOT, 'projects', id);
  if (fs.existsSync(projDir)) {
    console.log(`• projects/${id}/ уже есть — пропускаю копирование шаблона`);
  } else {
    fs.cpSync(path.join(ROOT, 'projects', '_template'), projDir, { recursive: true });
    console.log(`✓ создан projects/${id}/ из _template`);
  }

  // 2. Notion: карточка (идемпотентно по Local project ID)
  const cfg = loadNotionConfig();
  let client = await findClientByProjectId(cfg.databases.clients, id);
  if (client) {
    console.log(`• клиент уже в Notion: ${pageUrl(client)} — карточку не дублирую`);
  } else {
    client = await createClient(cfg.databases.clients, {
      name, projectId: id, platforms, operator: values.operator, focus: values.focus, status: 'active',
    });
    console.log(`✓ карточка Notion: ${pageUrl(client)}`);
  }

  // 3. План (опционально)
  if (!values['no-plan']) {
    const plan = await createPlan(cfg.databases.plans, {
      name: `${name} — план`, clientPageId: client.id, status: 'черновик',
    });
    console.log(`✓ план Notion: ${pageUrl(plan)}`);
  }

  // 4. channels.json — реестр каналов проекта
  const chPath = path.join(projDir, 'channels.json');
  if (!fs.existsSync(chPath)) {
    fs.writeFileSync(chPath, JSON.stringify({ notionClientPageId: client.id, channels: [] }, null, 2) + '\n');
    console.log(`✓ ${path.relative(ROOT, chPath)}`);
  }

  console.log('\nГотово. Дальше: снять бриф → заполнить context/voice/strategy → подключить каналы:');
  console.log(`  node tools/onboard/register-channel.mjs --id ${id} --type vk --group-id <ID> --token <vk1.a...>`);
})().catch((e) => die(e.message));
