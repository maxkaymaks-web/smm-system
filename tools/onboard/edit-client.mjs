#!/usr/bin/env node
// Править клиента: поля карточки Notion + дозапись в overrides.md ("запомни/так не делай").
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadNotionConfig, findClientByProjectId, updateClient, pageUrl } from '../lib/notion.mjs';

const ROOT = process.cwd();
const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    status: { type: 'string' },             // active | paused
    operator: { type: 'string' },
    focus: { type: 'string' },
    platforms: { type: 'string' },          // "VK,Telegram,MAX" — перезапись
    remember: { type: 'string' },           // строка в overrides.md
  },
});

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
const id = values.id;
if (!id) die('нужен --id');

(async () => {
  // 1. Notion-патч (только заданные поля)
  const patch = {};
  if (values.status !== undefined)   patch.status = values.status;
  if (values.operator !== undefined) patch.operator = values.operator;
  if (values.focus !== undefined)    patch.focus = values.focus;
  if (values.platforms !== undefined) patch.platforms = values.platforms.split(',').map((s) => s.trim()).filter(Boolean);

  if (Object.keys(patch).length) {
    const cfg = loadNotionConfig();
    const client = await findClientByProjectId(cfg.databases.clients, id);
    if (!client) die(`клиент ${id} не найден в Notion (Local project ID)`);
    await updateClient(client.id, patch);
    console.log(`✓ Notion обновлён: ${Object.keys(patch).join(', ')} → ${pageUrl(client)}`);
  }

  // 2. overrides.md — дозапись
  if (values.remember) {
    const ovPath = path.join(ROOT, 'projects', id, 'overrides.md');
    if (!fs.existsSync(ovPath)) die(`нет ${path.relative(ROOT, ovPath)} — сначала заведи клиента (new-client)`);
    const date = new Date().toISOString().slice(0, 10);
    const head = '## Запомни / так не делай';
    let text = fs.readFileSync(ovPath, 'utf8');
    if (!text.includes(head)) text += `\n\n${head}\n`;
    text += `- (${date}) ${values.remember}\n`;
    fs.writeFileSync(ovPath, text);
    console.log(`✓ overrides.md: записано "${values.remember}"`);
  }

  if (!Object.keys(patch).length && !values.remember) {
    console.log('Нечего менять. Флаги: --status --operator --focus --platforms --remember');
  }
})().catch((e) => die(e.message));
