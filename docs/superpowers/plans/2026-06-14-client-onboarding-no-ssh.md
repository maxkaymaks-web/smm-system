# Онбординг и правка клиента без SSH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать оператору заводить/править клиента и подключать его соцканалы полностью без ssh — через локальные Node-тулы (репо + Notion API) и один тонкий серверный сервис, который пишет канал в БД Postiz.

**Architecture:** Локальные `.mjs`-тулы в `tools/onboard/` ходят по HTTPS в Notion (карточки клиентов) и в наш `onboard-service` (регистрация каналов). `onboard-service` — Node-сервис в Docker рядом с Postiz, делает `INSERT` в таблицу `Integration` Postiz (public API Postiz это не умеет). Публикация постов — штатным Postiz public API. Связка «клиент→канал» хранится в `projects/{id}/channels.json` (`integrationId`).

**Tech Stack:** Node.js ESM (`.mjs`), `node:util` parseArgs, `node:test`, глобальный `fetch` (Node 18+), `pg` (только внутри onboard-service), Docker + nginx (деплой серверной части).

**Опорные документы:** спека `docs/superpowers/specs/2026-06-14-client-onboarding-no-ssh-design.md`, грабли Postiz `docs/postiz-integration.md`, инфра `docs/infra.md`, схемы Notion в `config/notion.json`.

**Конвенции репо (соблюдать):**
- `.env` грузить тем же `loadEnv()`, что в `tools/s3.mjs` (построчно, regex `^([A-Z0-9_]+)=(.+)$`, не перетирать уже заданные `process.env`).
- Тулы **не делают `git commit/push`** — это противоречит `CLAUDE.md` (коммит только с подтверждения оператора).
- Все сообщения — по-русски, как в остальных тулах.

---

## Структура файлов

| Файл | Ответственность |
|------|-----------------|
| `tools/lib/notion.mjs` (создать) | Обёртка Notion REST: `loadEnv`, `notion()`, `buildClientProps`, `buildPlanProps`, `findClientByProjectId`, `createClient`, `updateClient`, `createPlan`, `loadNotionConfig` |
| `tools/lib/notion.test.mjs` (создать) | Юнит на чистые билдеры свойств (`node:test`) |
| `tools/onboard/new-client.mjs` (создать) | Скелет `projects/{id}/` + карточка Notion + `channels.json` |
| `tools/onboard/edit-client.mjs` (создать) | Правка полей карточки Notion + дозапись в `overrides.md` |
| `tools/onboard/register-channel.mjs` (создать) | HTTPS-вызов onboard-service, дозапись `integrationId` в `channels.json` |
| `projects/_template/voice.md` (создать) | В шаблоне нет `voice.md` — добавить пустую заготовку |
| `tools/onboard-service/server.mjs` (создать) | HTTP-сервис: auth + валидация токена + upsert в `Integration` Postiz |
| `tools/onboard-service/package.json` (создать) | Зависимость `pg`, `type:module` |
| `tools/onboard-service/Dockerfile` (создать) | Контейнер сервиса |
| `tools/onboard-service/README.md` (создать) | Контракт API + как деплоить |
| `.env.example` (изменить) | Добавить `ONBOARD_API_URL`, `ONBOARD_API_KEY` |
| `docs/client-onboarding.md` (изменить) | Шаги 2/3/5 → через тулы, а не руками |
| `CLAUDE.md` (изменить) | В «Где что лежит» — новые тулы; короткий блок «Онбординг/публикация» |
| `.claude/agents/brief.md` (изменить) | Брифу — звать `new-client` после снятия брифа |
| `global/UPDATES.md` (изменить) | Запись об онбординг-тулах |

---

## Task 1: `tools/lib/notion.mjs` — обёртка Notion + билдеры свойств

**Files:**
- Create: `tools/lib/notion.mjs`
- Test: `tools/lib/notion.test.mjs`

- [ ] **Step 1: Написать падающий тест на билдеры свойств**

`tools/lib/notion.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClientProps, buildPlanProps } from './notion.mjs';

test('buildClientProps: полный набор полей', () => {
  const p = buildClientProps({
    name: 'Beauty Culture', projectId: 'BeautyCulture',
    platforms: ['VK', 'Telegram'], operator: 'Настя',
    focus: 'запуск', status: 'active',
  });
  assert.equal(p['Name'].title[0].text.content, 'Beauty Culture');
  assert.equal(p['Local project ID'].rich_text[0].text.content, 'BeautyCulture');
  assert.equal(p['Статус'].select.name, 'active');
  assert.deepEqual(p['Платформы'].multi_select.map(o => o.name), ['VK', 'Telegram']);
  assert.equal(p['Оператор'].rich_text[0].text.content, 'Настя');
  assert.equal(p['Текущий фокус'].rich_text[0].text.content, 'запуск');
});

test('buildClientProps: частичный набор — только заданные ключи', () => {
  const p = buildClientProps({ status: 'paused' });
  assert.deepEqual(Object.keys(p), ['Статус']);
  assert.equal(p['Статус'].select.name, 'paused');
});

test('buildPlanProps: связь с клиентом + дефолтный статус', () => {
  const p = buildPlanProps({ name: 'BC — июнь', clientPageId: 'pageid-1' });
  assert.equal(p['Name'].title[0].text.content, 'BC — июнь');
  assert.equal(p['Статус'].select.name, 'черновик');
  assert.equal(p['Клиент'].relation[0].id, 'pageid-1');
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `node --test tools/lib/notion.test.mjs`
Expected: FAIL — `Cannot find module` / `buildClientProps is not a function`.

- [ ] **Step 3: Реализовать `tools/lib/notion.mjs`**

```js
// tools/lib/notion.mjs — тонкая обёртка Notion REST (без SDK, на fetch)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VERSION = '2022-06-28';
const BASE = 'https://api.notion.com/v1';

export function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export function loadNotionConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/notion.json'), 'utf8'));
}

export async function notion(method, p, body) {
  loadEnv();
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN не задан в .env');
  const res = await fetch(BASE + p, {
    method,
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.object === 'error') {
    throw new Error(`Notion ${json.status} ${json.code}: ${json.message}`);
  }
  return json;
}

// --- чистые билдеры свойств (юнит-тестируемые) ---
export function buildClientProps(p) {
  const out = {};
  if (p.name !== undefined)      out['Name'] = { title: [{ text: { content: p.name } }] };
  if (p.projectId !== undefined) out['Local project ID'] = { rich_text: [{ text: { content: p.projectId } }] };
  if (p.status !== undefined)    out['Статус'] = { select: { name: p.status } };
  if (p.platforms !== undefined) out['Платформы'] = { multi_select: (p.platforms || []).map((n) => ({ name: n })) };
  if (p.operator !== undefined)  out['Оператор'] = { rich_text: [{ text: { content: p.operator } }] };
  if (p.focus !== undefined)     out['Текущий фокус'] = { rich_text: [{ text: { content: p.focus } }] };
  return out;
}

export function buildPlanProps({ name, clientPageId, period, status = 'черновик' }) {
  const out = {
    'Name': { title: [{ text: { content: name } }] },
    'Статус': { select: { name: status } },
  };
  if (clientPageId) out['Клиент'] = { relation: [{ id: clientPageId }] };
  if (period)       out['Период'] = { rich_text: [{ text: { content: period } }] };
  return out;
}

// --- операции ---
export async function findClientByProjectId(dbId, projectId) {
  const r = await notion('POST', `/databases/${dbId}/query`, {
    filter: { property: 'Local project ID', rich_text: { equals: projectId } },
    page_size: 1,
  });
  return r.results[0] || null;
}

export async function createClient(dbId, data) {
  return notion('POST', '/pages', { parent: { database_id: dbId }, properties: buildClientProps(data) });
}

export async function updateClient(pageId, data) {
  return notion('PATCH', `/pages/${pageId}`, { properties: buildClientProps(data) });
}

export async function createPlan(dbId, data) {
  return notion('POST', '/pages', { parent: { database_id: dbId }, properties: buildPlanProps(data) });
}

export function pageUrl(page) {
  return page.url || `https://notion.so/${(page.id || '').replace(/-/g, '')}`;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `node --test tools/lib/notion.test.mjs`
Expected: PASS (3 теста).

- [ ] **Step 5: Коммит**

```bash
git add tools/lib/notion.mjs tools/lib/notion.test.mjs
git commit -m "tools: notion-обёртка для онбординга (билдеры свойств + операции)"
```

---

## Task 2: `projects/_template/voice.md` — заготовка голоса в шаблоне

**Files:**
- Create: `projects/_template/voice.md`

- [ ] **Step 1: Создать заготовку**

`projects/_template/voice.md`:
```markdown
# Голос бренда

> Приоритетный документ: перекрывает всё. Без явной команды оператора не редактировать.

## Тональность

(заполняется по брифу — как звучит бренд: обращение, эмоция, лексика)

## Что можно

## Что нельзя
```

- [ ] **Step 2: Проверить, что шаблон копируется целиком**

Run: `ls projects/_template/voice.md && echo OK`
Expected: путь + `OK`.

- [ ] **Step 3: Коммит**

```bash
git add projects/_template/voice.md
git commit -m "tools: voice.md в _template (нужен скелету онбординга)"
```

---

## Task 3: `tools/onboard/new-client.mjs` — завести клиента

**Files:**
- Create: `tools/onboard/new-client.mjs`

- [ ] **Step 1: Реализовать тул**

`tools/onboard/new-client.mjs`:
```js
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
```

- [ ] **Step 2: Завести тестового клиента (smoke против тестовых баз Notion)**

Run:
```bash
node tools/onboard/new-client.mjs --id ZZTest_Onboard --name "ZZ Test" --platforms VK,Telegram --operator "Тест"
```
Expected: строки `✓ создан projects/ZZTest_Onboard/`, `✓ карточка Notion: …`, `✓ план Notion: …`, `✓ projects/ZZTest_Onboard/channels.json`.

- [ ] **Step 3: Проверить идемпотентность (повторный запуск)**

Run: тот же запуск ещё раз.
Expected: `• projects/ZZTest_Onboard/ уже есть …`, `• клиент уже в Notion: … — карточку не дублирую`. Дубля карточки в базе нет.

- [ ] **Step 4: Прибрать тестовые артефакты**

Run:
```bash
rm -rf projects/ZZTest_Onboard
```
А карточку/план «ZZ Test» в Notion удалить вручную в UI (тестовая страница) — API архивирование не вызываем, чтобы не плодить кода под разовую уборку.

- [ ] **Step 5: Коммит**

```bash
git add tools/onboard/new-client.mjs
git commit -m "tools: new-client — завести клиента (репо + Notion) без ssh"
```

---

## Task 4: `tools/onboard/edit-client.mjs` — править клиента

**Files:**
- Create: `tools/onboard/edit-client.mjs`

- [ ] **Step 1: Реализовать тул**

`tools/onboard/edit-client.mjs`:
```js
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
```

- [ ] **Step 2: Smoke (на том же тестовом клиенте, если ещё не прибран, иначе завести заново)**

Run:
```bash
node tools/onboard/new-client.mjs --id ZZTest_Edit --name "ZZ Edit" --platforms VK --no-plan
node tools/onboard/edit-client.mjs --id ZZTest_Edit --status paused --focus "осенняя акция" --remember "не использовать жёлтый фон"
```
Expected: `✓ Notion обновлён: status, focus → …`, `✓ overrides.md: записано "не использовать жёлтый фон"`.
Проверить: `grep "жёлтый фон" projects/ZZTest_Edit/overrides.md` → строка найдена.

- [ ] **Step 3: Прибрать**

Run: `rm -rf projects/ZZTest_Edit` (+ удалить карточку «ZZ Edit» в Notion UI).

- [ ] **Step 4: Коммит**

```bash
git add tools/onboard/edit-client.mjs
git commit -m "tools: edit-client — правка полей Notion + overrides без ssh"
```

---

## Task 5: `onboard-service` — серверный сервис регистрации каналов

> Этот сервис кладёт канал в БД Postiz. Деплой — Task 7 (разработчик, ssh). Здесь — код.

**Files:**
- Create: `tools/onboard-service/server.mjs`
- Create: `tools/onboard-service/package.json`
- Create: `tools/onboard-service/Dockerfile`
- Create: `tools/onboard-service/README.md`

- [ ] **Step 1: `package.json` сервиса**

`tools/onboard-service/package.json`:
```json
{
  "name": "onboard-service",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "dependencies": { "pg": "^8.13.1" }
}
```

- [ ] **Step 2: Реализовать `server.mjs`**

Сервис: bearer-auth → валидация токена соцсети → upsert в `Integration` (SELECT по `(organizationId, providerIdentifier, internalId)`, потом INSERT или UPDATE — без опоры на уникальный констрейнт). Токен пишется **СЫРЫМ** (Postiz не шифрует — см. `docs/postiz-integration.md`).

`tools/onboard-service/server.mjs`:
```js
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const {
  ONBOARD_API_KEY, DATABASE_URL, POSTIZ_ORG_ID,
  TELEGRAM_TOKEN, VK_SERVICE_TOKEN, PORT = '4010',
} = process.env;

if (!ONBOARD_API_KEY || !DATABASE_URL || !POSTIZ_ORG_ID) {
  console.error('нужны env: ONBOARD_API_KEY, DATABASE_URL, POSTIZ_ORG_ID');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: DATABASE_URL });

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  req.on('error', reject);
});

// --- валидация токенов через соцсети ---
async function validateVk(token) {
  const u = `https://api.vk.com/method/groups.getById?access_token=${encodeURIComponent(token)}&v=5.199`;
  const r = await (await fetch(u)).json();
  if (r.error) throw new Error(`VK-токен невалиден: ${r.error.error_msg}`);
}
async function validateTelegram(chatId) {
  if (!TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN не задан в сервисе');
  const u = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getChat?chat_id=${encodeURIComponent(chatId)}`;
  const r = await (await fetch(u)).json();
  if (!r.ok) throw new Error(`Telegram getChat: ${r.description} (бот добавлен админом канала?)`);
  return r.result.title || String(chatId);
}

// --- upsert интеграции ---
async function upsertIntegration({ name, providerIdentifier, internalId, token }) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const found = await c.query(
      `SELECT id FROM "Integration"
       WHERE "organizationId"=$1 AND "providerIdentifier"=$2 AND "internalId"=$3
       LIMIT 1`,
      [POSTIZ_ORG_ID, providerIdentifier, internalId],
    );
    if (found.rows[0]) {
      const id = found.rows[0].id;
      await c.query(
        `UPDATE "Integration" SET "token"=$1, "name"=$2, "updatedAt"=NOW(), "disabled"=false, "deletedAt"=NULL WHERE id=$3`,
        [token, name, id],
      );
      await c.query('COMMIT');
      return { id, updated: true };
    }
    const id = crypto.randomUUID();
    await c.query(
      `INSERT INTO "Integration"
        (id, "internalId", "organizationId", name, "providerIdentifier", type, token, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'social',$6,NOW(),NOW())`,
      [id, internalId, POSTIZ_ORG_ID, name, providerIdentifier, token],
    );
    await c.query('COMMIT');
    return { id, updated: false };
  } catch (e) {
    await c.query('ROLLBACK'); throw e;
  } finally {
    c.release();
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${ONBOARD_API_KEY}`) return json(res, 401, { error: 'unauthorized' });
    const url = new URL(req.url, 'http://x');

    if (req.method === 'GET' && url.pathname === '/channels') {
      const r = await pool.query(
        `SELECT id, name, "providerIdentifier", "internalId" FROM "Integration"
         WHERE "organizationId"=$1 AND "deletedAt" IS NULL ORDER BY "createdAt"`,
        [POSTIZ_ORG_ID],
      );
      return json(res, 200, { channels: r.rows });
    }

    if (req.method === 'POST' && url.pathname === '/channels') {
      const body = await readBody(req);
      const { type, name } = body;
      if (type === 'vk') {
        const { groupId, token } = body.vk || {};
        if (!groupId || !token) return json(res, 422, { error: 'нужны vk.groupId и vk.token' });
        await validateVk(token);
        const r = await upsertIntegration({
          name: name || `vk-${groupId}`, providerIdentifier: 'vk',
          internalId: String(groupId), token,
        });
        return json(res, 200, { integrationId: r.id, providerIdentifier: 'vk', internalId: String(groupId), updated: r.updated });
      }
      if (type === 'telegram') {
        const { chatId } = body.telegram || {};
        if (!chatId) return json(res, 422, { error: 'нужен telegram.chatId' });
        const title = await validateTelegram(chatId);
        const r = await upsertIntegration({
          name: name || title, providerIdentifier: 'telegram',
          internalId: String(chatId), token: String(chatId),
        });
        return json(res, 200, { integrationId: r.id, providerIdentifier: 'telegram', internalId: String(chatId), updated: r.updated });
      }
      return json(res, 422, { error: 'type должен быть vk|telegram' });
    }

    return json(res, 404, { error: 'not found' });
  } catch (e) {
    const code = /невалиден|getChat|нужны|нужен/.test(e.message) ? 422 : 500;
    json(res, code, { error: e.message });
  }
});
server.listen(Number(PORT), () => console.log(`onboard-service на :${PORT}`));
```

- [ ] **Step 3: ВАЖНО — сверить колонки таблицы `Integration` на боевой БД перед финалом**

На сервере (Task 7 окружение):
```bash
docker exec postiz-postgres psql -U postiz -d postiz -c '\d "Integration"'
```
Expected: список колонок. Сверить, что `INSERT` из Step 2 покрывает **все NOT NULL без дефолта**. Если найдётся доп. NOT NULL (напр. `picture`, `profile`, `customInstanceDetails`) — добавить её в `INSERT` с безопасным значением (`''` / `NULL`-совместимо). Это единственная адаптация по факту схемы; код выше покрывает документированные обязательные поля (id, internalId, organizationId, name, providerIdentifier, type, token).

- [ ] **Step 4: `Dockerfile`**

`tools/onboard-service/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
EXPOSE 4010
CMD ["node", "server.mjs"]
```

- [ ] **Step 5: `README.md` (контракт + деплой)**

`tools/onboard-service/README.md`:
```markdown
# onboard-service

Тонкий HTTP-сервис: регистрирует соцканал клиента в БД Postiz (INSERT в `Integration`),
т.к. public API Postiz создавать интеграции с готовым токеном не умеет.

## Контракт
- Auth: `Authorization: Bearer $ONBOARD_API_KEY`.
- `POST /channels` body `{type:"vk", name, vk:{groupId, token}}`
  или `{type:"telegram", name, telegram:{chatId}}` → `{integrationId, updated}`.
- `GET /channels` → `{channels:[{id,name,providerIdentifier,internalId}]}`.
- Идемпотентность: по `(organizationId, providerIdentifier, internalId)` — апдейт, не дубль.
- Токен пишется СЫРЫМ (Postiz не шифрует, см. docs/postiz-integration.md).

## Env
`ONBOARD_API_KEY`, `DATABASE_URL` (как у backend Postiz), `POSTIZ_ORG_ID`,
`TELEGRAM_TOKEN` (валидация TG + штатный TG-провайдер Postiz), `VK_SERVICE_TOKEN` (опц.).

## Деплой — см. план Task 7 (docker-compose.trim.yaml + nginx /onboard/).
```

- [ ] **Step 6: Коммит**

```bash
git add tools/onboard-service/
git commit -m "tools: onboard-service — регистрация каналов в Postiz по HTTPS (код)"
```

---

## Task 6: `tools/onboard/register-channel.mjs` — операторский тул каналов

**Files:**
- Create: `tools/onboard/register-channel.mjs`

- [ ] **Step 1: Реализовать тул**

`tools/onboard/register-channel.mjs`:
```js
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
  payload = { projectId: id, type: 'telegram', name: values.name, telegram: { chatId: Number(values['chat-id']) } };
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
  reg.channels.push({ type, integrationId: out.integrationId, internalId: out.internalId, name: values.name });
  fs.writeFileSync(chPath, JSON.stringify(reg, null, 2) + '\n');

  console.log(`✓ канал ${type} ${out.updated ? 'обновлён' : 'зарегистрирован'}: integrationId=${out.integrationId}`);
  console.log(`✓ записан в projects/${id}/channels.json`);
})().catch((e) => die(e.message));
```

- [ ] **Step 2: Smoke (после деплоя Task 7) — зарегистрировать тестовый VK**

Run:
```bash
node tools/onboard/register-channel.mjs --id ZZTest_Chan --type vk \
  --group-id 239528257 --token "$(grep '^VK_COMMUNITY_TOKEN=' .env | cut -d= -f2-)" --name "bit&pix VK"
```
Expected: `✓ канал vk зарегистрирован: integrationId=…`, запись в `channels.json`.
(Предварительно `node tools/onboard/new-client.mjs --id ZZTest_Chan --name "ZZ Chan" --no-plan`.)

- [ ] **Step 3: Проверить публикацию через Postiz (боевой тест связки)**

Run (взять integrationId из channels.json):
```bash
# upload-from-url одной картинки + создать пост type=now settings.__type=vk
# (URL картинки — node tools/s3.mjs url smm/projects/Sparta/posts/drafts/23_05_2026-1/slide_01.png)
```
Expected: пост опубликован на стене `https://vk.com/wall-239528257_N` (проверка как в `docs/postiz-integration.md` §«ЧТО ДАЛЬШЕ»).

- [ ] **Step 4: Идемпотентность — повторная регистрация**

Run: тот же `register-channel` повторно.
Expected: `✓ канал vk обновлён: integrationId=<тот же>`. Дубля в `GET /channels` нет.

- [ ] **Step 5: Прибрать тест** (`rm -rf projects/ZZTest_Chan`; интеграцию оставить — она боевой bit&pix VK).

- [ ] **Step 6: Коммит**

```bash
git add tools/onboard/register-channel.mjs
git commit -m "tools: register-channel — подключение VK/TG канала без ssh"
```

---

## Task 7: Деплой onboard-service на сервер (разработчик, ssh)

> Единственная задача с ssh — её делает разработчик один раз. Операторов это не касается.

**Files:**
- Modify (на сервере): `/opt/postiz-official/docker-compose.trim.yaml`
- Modify (на сервере): `/etc/nginx/sites-available/tech.bitandpix.ru`

- [ ] **Step 1: Залить код сервиса на сервер**

```bash
cd /home/pavel/projects/smm-system
tar czf /tmp/onboard-service.tgz -C tools onboard-service
cat /tmp/onboard-service.tgz | ssh -p 22 root@5.42.117.201 'cat > /tmp/onboard-service.tgz && mkdir -p /opt/postiz-official/onboard-service && tar xzf /tmp/onboard-service.tgz -C /opt/postiz-official/ --strip-components=0'
```
(Распаковка кладёт `/opt/postiz-official/onboard-service/`.)

- [ ] **Step 2: Узнать `DATABASE_URL` Postiz + сгенерировать ключ**

```bash
ssh -p 22 root@5.42.117.201 "grep -E '^DATABASE_URL=' /opt/postiz-official/.env; echo KEY=$(openssl rand -hex 24)"
```
Запомнить `DATABASE_URL` и сгенерированный `ONBOARD_API_KEY`.

- [ ] **Step 3: Добавить сервис в `docker-compose.trim.yaml`**

Дописать в `services:` (та же сеть, что у postiz/postgres):
```yaml
  onboard-service:
    build: ./onboard-service
    restart: always
    environment:
      ONBOARD_API_KEY: "<сгенерённый ключ>"
      DATABASE_URL: "<DATABASE_URL Postiz>"
      POSTIZ_ORG_ID: "637b7803-9bd5-472e-ad37-cf2ce87ac773"
      TELEGRAM_TOKEN: "<токен bit_and_pix_bot>"
      PORT: "4010"
    ports:
      - "127.0.0.1:4010:4010"
```

- [ ] **Step 4: Сверить схему `Integration` (см. Task 5 Step 3) и поднять**

```bash
ssh -p 22 root@5.42.117.201 'docker exec postiz-postgres psql -U postiz -d postiz -c "\d \"Integration\"" '
ssh -p 22 root@5.42.117.201 'cd /opt/postiz-official && docker compose -f docker-compose.trim.yaml up -d --build onboard-service'
```
Если в схеме нашлись доп. NOT NULL — поправить INSERT в `server.mjs`, перелить (Step 1), пересобрать.

- [ ] **Step 5: nginx — маршрут `/onboard/`**

В server-блоке `tech.bitandpix.ru` (443) добавить ДО общего `location /`:
```nginx
location /onboard/ {
    proxy_pass http://127.0.0.1:4010/;
    proxy_set_header Host $host;
}
```
Затем:
```bash
ssh -p 22 root@5.42.117.201 'nginx -t && systemctl reload nginx'
```

- [ ] **Step 6: Smoke снаружи**

```bash
curl -s -H "Authorization: Bearer <ключ>" https://tech.bitandpix.ru/onboard/channels
```
Expected: `{"channels":[...]}` (200). Без ключа → `{"error":"unauthorized"}` (401).

- [ ] **Step 7: Прописать ключи операторам и в `.env`**

Добавить в локальный `.env` (и выдать операторам):
```
ONBOARD_API_URL=https://tech.bitandpix.ru/onboard
ONBOARD_API_KEY=<ключ>
```

- [ ] **Step 8: Зафиксировать инфру в доке (не в git серверные секреты!)**

Дописать в `docs/infra.md` блок про onboard-service (порт 4010, nginx /onboard/, что секреты в server-env). Коммит.
```bash
git add docs/infra.md && git commit -m "docs: onboard-service в инфре (порт 4010, nginx /onboard/)"
```

---

## Task 8: Документация — как агентам проходить флоу по-новому

**Files:**
- Modify: `.env.example`
- Modify: `docs/client-onboarding.md`
- Modify: `CLAUDE.md`
- Modify: `.claude/agents/brief.md`
- Modify: `global/UPDATES.md`

- [ ] **Step 1: `.env.example` — новые ключи**

Дописать (рядом с `NOTION_TOKEN`):
```
# Онбординг каналов (onboard-service на сервере)
ONBOARD_API_URL=https://tech.bitandpix.ru/onboard
ONBOARD_API_KEY=
```

- [ ] **Step 2: `docs/client-onboarding.md` — шаги 2/3/5 через тулы**

Заменить ручные описания на вызовы тулов. Шаг 2:
```markdown
## Шаг 2. Завести клиента (скелет + Notion) — одной командой

    node tools/onboard/new-client.mjs --id {ProjectID} --name "{Имя}" \
      --platforms VK,Telegram --operator "{оператор}" --focus "{фокус}"

Создаёт `projects/{ProjectID}/` из `_template`, карточку в базе «Клиенты» и план-черновик,
плюс `channels.json` (реестр каналов). Идемпотентно. Дальше заполняешь
context/voice/strategy руками/через brief.
```
Шаг 3 (Notion) — отметить, что карточка/план уже созданы тулом; строки-посты заводит
контент-флоу. Шаг 5 (каналы):
```markdown
## Шаг 5. Подключить каналы — без ssh

    # VK: клиент создаёт community-токен (вкладка «Работа с API» сообщества)
    node tools/onboard/register-channel.mjs --id {ProjectID} --type vk --group-id {GID} --token {vk1.a...}
    # Telegram: добавить @bit_and_pix_bot админом канала, затем
    node tools/onboard/register-channel.mjs --id {ProjectID} --type telegram --chat-id {-100...}

Тул пишет канал в Postiz через onboard-service и сохраняет `integrationId` в
`projects/{ProjectID}/channels.json`. Публикация — Postiz API по этому id
(см. `docs/postiz-integration.md`). Правки клиента: `node tools/onboard/edit-client.mjs --id {ProjectID} ...`.
```

- [ ] **Step 3: `CLAUDE.md` — тулы в «Где что лежит» + блок флоу**

В список `tools/` добавить:
```markdown
  ├─ onboard/new-client.mjs       завести клиента (репо + Notion), без ssh
  ├─ onboard/edit-client.mjs      править поля клиента в Notion + overrides
  ├─ onboard/register-channel.mjs подключить VK/TG канал в Postiz, без ssh
  ├─ onboard-service/             серверный сервис регистрации каналов (на сервере)
  └─ lib/notion.mjs               обёртка Notion API
```
И короткий блок после «Архитектура»:
```markdown
## Онбординг и публикация (без ssh)

- Завести/править клиента: `tools/onboard/new-client.mjs`, `edit-client.mjs`
  (репо-скелет + карточка Notion). Подключить соцканалы:
  `tools/onboard/register-channel.mjs` (VK community-токен / TG-канал → Postiz).
- Связка клиент→канал — в `projects/{ID}/channels.json` (`integrationId`).
- Публикация: Postiz public API (`upload-from-url` ×N → `/posts`,
  `settings.__type`), реальные токены соцсетей держит Postiz. Детали —
  `docs/postiz-integration.md`, полный флоу — `docs/client-onboarding.md`.
```

- [ ] **Step 4: `.claude/agents/brief.md` — звать new-client после брифа**

В конце инструкции брифа добавить:
```markdown
## После брифа — завести клиента
Сняв бриф, предложи оператору завести клиента одной командой:
`node tools/onboard/new-client.mjs --id {ProjectID} --name "..." --platforms ... --operator "..."`.
Это создаёт скелет проекта и карточку Notion. Каналы подключаются отдельно
(`register-channel`). Подробности — docs/client-onboarding.md.
```

- [ ] **Step 5: `global/UPDATES.md` — запись сверху**

```markdown
## 2026-06-14 — Онбординг клиента без ssh
Появились тулы `tools/onboard/{new-client,edit-client,register-channel}.mjs`:
оператор заводит/правит клиента и подключает VK/TG каналы по HTTPS, без ssh и
без ручной правки БД. Каналы регистрирует серверный `onboard-service`. Секреты
у оператора — только `NOTION_TOKEN` + `ONBOARD_API_KEY`. Флоу — docs/client-onboarding.md.
```

- [ ] **Step 6: Коммит**

```bash
git add .env.example docs/client-onboarding.md CLAUDE.md .claude/agents/brief.md global/UPDATES.md
git commit -m "docs: онбординг-флоу без ssh для агентов (тулы + new-client/register-channel)"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** §5.1 notion.mjs → Task 1; §5.2 new-client → Task 3 (+ voice.md Task 2); §5.3 edit-client → Task 4; §5.4 register-channel → Task 6; §5.5 onboard-service → Task 5; §6 контракт → Task 5 server.mjs; §8 тесты → шаги smoke в Task 1/3/4/6; §9 деплой → Task 7; §10 риск схемы `Integration` → Task 5 Step 3 + Task 7 Step 4; доки для агентов (запрос пользователя) → Task 8.
- **Плейсхолдеры:** в коде их нет; `<ключ>`/`<DATABASE_URL>` в Task 7 — реальные значения, добываются в Step 2 (не TODO).
- **Согласованность типов:** `buildClientProps`/`buildPlanProps`/`findClientByProjectId`/`createClient`/`updateClient`/`createPlan`/`pageUrl` из Task 1 используются под теми же именами в Task 3/4. `integrationId`/`internalId`/`updated` из server.mjs (Task 5) совпадают с тем, что читает register-channel (Task 6). `channels.json` форма (`notionClientPageId`, `channels[]`) согласована между new-client (Task 3) и register-channel (Task 6).
```
