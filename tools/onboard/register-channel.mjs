#!/usr/bin/env node
// Зарегистрировать канал клиента в Postiz через onboard-service (без ssh).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnv } from '../lib/notion.mjs';

const ROOT = process.cwd();
loadEnv();
const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    type: { type: 'string' },                // vk | telegram
    'group-id': { type: 'string' },
    token: { type: 'string' },
    'chat-id': { type: 'string' },
    name: { type: 'string', default: '' },
  },
});
function die(msg) { console.error('✗ ' + msg); process.exit(1); }

const id = values.id, type = values.type;
if (!id || !type) die('нужны --id и --type (vk|telegram)');
const apiUrl = process.env.ONBOARD_API_URL;
const apiKey = process.env.ONBOARD_API_KEY;
if (!apiUrl || !apiKey) die('ONBOARD_API_URL / ONBOARD_API_KEY не заданы в .env');

let payload;
if (type === 'vk') {
  if (!values['group-id'] || !values.token) die('для vk нужны --group-id и --token');
  payload = { projectId: id, type: 'vk', name: values.name, vk: { groupId: Number(values['group-id']), token: values.token } };
} else if (type === 'telegram') {
  if (!values['chat-id']) die('для telegram нужен --chat-id');
  // chat-id оставляем строкой: getChat принимает и числовой -100…, и @username
  payload = { projectId: id, type: 'telegram', name: values.name, telegram: { chatId: values['chat-id'] } };
} else {
  die('--type должен быть vk|telegram');
}

(async () => {
  const res = await fetch(apiUrl.replace(/\/$/, '') + '/channels', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const out = await res.json();
  if (!res.ok) die(`сервис вернул ${res.status}: ${out.error || JSON.stringify(out)}`);

  // дозапись в channels.json
  const chPath = path.join(ROOT, 'projects', id, 'channels.json');
  const reg = fs.existsSync(chPath)
    ? JSON.parse(fs.readFileSync(chPath, 'utf8'))
    : { notionClientPageId: null, channels: [] };
  reg.channels = reg.channels.filter((c) => c.integrationId !== out.integrationId);
  reg.channels.push({ type, integrationId: out.integrationId, internalId: out.internalId, name: out.name || values.name });
  fs.writeFileSync(chPath, JSON.stringify(reg, null, 2) + '\n');

  console.log(`✓ канал ${type} ${out.updated ? 'обновлён' : 'зарегистрирован'}: integrationId=${out.integrationId}`);
  console.log(`✓ записан в projects/${id}/channels.json`);
})().catch((e) => die(e.message));
