#!/usr/bin/env node
// Разовый тест: получить user-токен VK через VK ID OAuth 2.1 + PKCE и проверить
// постинг фото-карусели на стену сообщества (getWallUploadServer → saveWallPhoto →
// wall.post from_group=1). Это эмпирическая проверка гейта wall/photos для нового
// приложения VK ID. Контекст — docs/vk-user-token-photos.md.
//
// Использование (три шага):
//   1) node tools/vk/oauth-photo-test.mjs authorize
//        → печатает ссылку. Открой её в браузере под аккаунтом-админом группы,
//          согласись. Браузер редиректнёт на http://localhost/?code=...&device_id=...
//          (страница не загрузится — это норм). Скопируй ВЕСЬ URL из адресной строки.
//   2) node tools/vk/oauth-photo-test.mjs exchange "<вставь_весь_redirect_URL>"
//        → меняет code на access_token (+refresh) и сохраняет в .vk-token.json
//   3) node tools/vk/oauth-photo-test.mjs post-photo
//        → грузит 2 слайда из S3 на стену группы GROUP_ID и постит карусель.
//
// Конфиг через env (или подставь ниже):
//   VK_APP_ID       — ID приложения (client_id), ОБЯЗАТЕЛЬНО
//   VK_APP_SECRET   — Защищённый ключ (client_secret), нужен только для confidential-app
//   VK_GROUP_ID     — id сообщества для теста (по умолч. 239528257 = bit&pix)

import crypto from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dir, '.vk-oauth-state.json');
const TOKEN_FILE = path.join(__dir, '.vk-token.json');

const APP_ID = process.env.VK_APP_ID;
const APP_SECRET = process.env.VK_APP_SECRET || '';
const GROUP_ID = process.env.VK_GROUP_ID || '239528257';
const REDIRECT_URI = 'http://localhost';
const SCOPE = 'wall photos groups';
const API_V = '5.199';

const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function needAppId() {
  if (!APP_ID) {
    console.error('❌ VK_APP_ID не задан. Запусти так:\n   VK_APP_ID=<client_id> node tools/vk/oauth-photo-test.mjs <cmd>');
    process.exit(1);
  }
}

async function authorize() {
  needAppId();
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  writeFileSync(STATE_FILE, JSON.stringify({ verifier, state }, null, 2));

  const url = new URL('https://id.vk.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  console.log('\n1) Открой ЭТУ ссылку в браузере под аккаунтом-админом группы:\n');
  console.log(url.toString());
  console.log('\n2) Согласись с правами. Браузер уйдёт на http://localhost/?code=... (страница не загрузится — ок).');
  console.log('3) Скопируй ВЕСЬ адрес из строки браузера и запусти:');
  console.log('   node tools/vk/oauth-photo-test.mjs exchange "<вставь_URL>"\n');
}

async function exchange(redirectUrl) {
  needAppId();
  if (!redirectUrl) { console.error('❌ Передай redirect URL в кавычках.'); process.exit(1); }
  if (!existsSync(STATE_FILE)) { console.error('❌ Нет state-файла. Сначала authorize.'); process.exit(1); }
  const { verifier, state } = JSON.parse(readFileSync(STATE_FILE, 'utf8'));

  const u = new URL(redirectUrl);
  const code = u.searchParams.get('code');
  const deviceId = u.searchParams.get('device_id');
  const retState = u.searchParams.get('state');
  if (!code) { console.error('❌ В URL нет ?code=. Проверь, что скопировал адрес после редиректа.'); process.exit(1); }
  if (retState !== state) console.warn('⚠️  state не совпал — продолжаю, но проверь что URL от этого authorize.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    state,
  });
  if (deviceId) body.set('device_id', deviceId);
  if (APP_SECRET) body.set('client_secret', APP_SECRET); // для confidential-app

  const res = await fetch('https://id.vk.com/oauth2/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('❌ Токен не получен. Ответ VK:\n', JSON.stringify(data, null, 2));
    console.error('\nЧастые причины: invalid code_challenge (PKCE), code протух (>10 мин), нет device_id, для confidential нужен client_secret/whitelist IP.');
    process.exit(1);
  }
  writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  console.log('✅ Токен получен и сохранён в tools/vk/.vk-token.json');
  console.log(`   scope=${data.scope}  expires_in=${data.expires_in}s  есть refresh_token=${!!data.refresh_token}`);
  console.log('   (сам токен в чат НЕ вставляй)');
}

async function vkCall(method, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token, v: API_V });
  const r = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return r.json();
}

async function postPhoto() {
  if (!existsSync(TOKEN_FILE)) { console.error('❌ Нет токена. Сначала authorize+exchange.'); process.exit(1); }
  const token = JSON.parse(readFileSync(TOKEN_FILE, 'utf8')).access_token;

  // Слайды из S3 (handoff: docs/postiz-integration.md)
  const keys = [
    'Sparta/posts/drafts/23_05_2026-1/slide_01.png',
    'Sparta/posts/drafts/23_05_2026-1/slide_02.png',
  ];
  const attachments = [];
  for (const key of keys) {
    // получить URL слайда из S3
    const { execSync } = await import('node:child_process');
    const url = execSync(`node ${path.join(__dir, '..', 's3.mjs')} url "${key}"`).toString().trim();
    const imgRes = await fetch(url);
    if (!imgRes.ok) { console.error(`❌ Не скачался слайд из S3: ${key} (${imgRes.status})`); process.exit(1); }
    const buf = Buffer.from(await imgRes.arrayBuffer());

    // 1) сервер загрузки фото на стену
    const up = await vkCall('photos.getWallUploadServer', { group_id: GROUP_ID }, token);
    if (up.error) { console.error('❌ getWallUploadServer:', JSON.stringify(up.error, null, 2)); process.exit(1); }
    const uploadUrl = up.response.upload_url;

    // 2) POST файла на upload_url (multipart)
    const fd = new FormData();
    fd.append('photo', new Blob([buf], { type: 'image/png' }), 'slide.png');
    const upRes = await fetch(uploadUrl, { method: 'POST', body: fd });
    const upJson = await upRes.json();

    // 3) сохранить фото на стене
    const saved = await vkCall('photos.saveWallPhoto', {
      group_id: GROUP_ID, server: upJson.server, photo: upJson.photo, hash: upJson.hash,
    }, token);
    if (saved.error) { console.error('❌ saveWallPhoto:', JSON.stringify(saved.error, null, 2)); process.exit(1); }
    const p = saved.response[0];
    attachments.push(`photo${p.owner_id}_${p.id}`);
    console.log(`   ✓ загружен ${key} → ${attachments.at(-1)}`);
  }

  // 4) пост от имени сообщества с фото-каруселью
  const post = await vkCall('wall.post', {
    owner_id: `-${GROUP_ID}`,
    from_group: 1,
    message: 'Тест: фото-карусель через user-токен (VK ID OAuth 2.1).',
    attachments: attachments.join(','),
  }, token);
  if (post.error) { console.error('❌ wall.post:', JSON.stringify(post.error, null, 2)); process.exit(1); }
  console.log(`\n✅ Опубликовано: https://vk.com/wall-${GROUP_ID}_${post.response.post_id}`);
  console.log('   Зайди залогиненным и ГЛАЗАМИ проверь, что фото видны на стене.');
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'authorize') await authorize();
else if (cmd === 'exchange') await exchange(arg);
else if (cmd === 'post-photo') await postPhoto();
else {
  console.log('Команды: authorize | exchange "<redirect_url>" | post-photo');
  console.log('Пример: VK_APP_ID=<client_id> node tools/vk/oauth-photo-test.mjs authorize');
}
