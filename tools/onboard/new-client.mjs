#!/usr/bin/env node
// Завести клиента: скелет projects/{id}/ + карточка Notion.
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
  const clientExisted = Boolean(client);
  if (client) {
    console.log(`• клиент уже в Notion: ${pageUrl(client)} — карточку не дублирую`);
  } else {
    client = await createClient(cfg.databases.clients, {
      name, projectId: id, platforms, operator: values.operator, focus: values.focus, status: 'active',
    });
    console.log(`✓ карточка Notion: ${pageUrl(client)}`);
  }

  // 3. План — только при первичном заведении (иначе повтор плодил бы дубли)
  if (!values['no-plan'] && !clientExisted) {
    const plan = await createPlan(cfg.databases.plans, {
      name: `${name} — план`, clientPageId: client.id, status: 'черновик',
    });
    console.log(`✓ план Notion: ${pageUrl(plan)}`);
  } else if (clientExisted) {
    console.log('• план не создаю (клиент уже был заведён)');
  }

  console.log('\nГотово. Дальше: снять бриф → заполнить context/voice/strategy.');
  console.log('Публикация — вручную (оператор постит сам).');
})().catch((e) => die(e.message));
