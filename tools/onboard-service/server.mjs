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
