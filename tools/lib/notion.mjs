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
