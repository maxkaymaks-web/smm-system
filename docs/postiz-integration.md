# Postiz — интеграция соцсетей (VK / Telegram). Рабочее состояние + продолжение

> Хэндофф рабочей сессии 13–14.06.2026. Что сделано, ключевые факты, грабли, что
> дальше. Инфра-детали сервера/HTTPS — в `docs/infra.md`. Конкуренты/онбординг —
> ресёрч был, выводы ниже.

## Где что

- **Postiz UI/API:** https://tech.bitandpix.ru (host-nginx → контейнер `:4007`).
  Сервер `5.42.117.201`, **SSH порт 22** (НЕ 24822!), стек `/opt/postiz-official/`,
  файл `docker-compose.trim.yaml` (5 контейнеров, без Elasticsearch — см. infra.md).
- **Админ Postiz:** `admin@bitpix.ru` / `Inbox-2723d32acb-Aa9!` (SUPERADMIN).
- **API-ключ для Claude:** `POSTIZ_API_KEY` в репо `.env` (= `Organization.apiKey`).
  Заголовок `Authorization: <key>` (без Bearer). Базовый URL
  `POSTIZ_API_URL=https://tech.bitandpix.ru` (host без `/api`); все эндпоинты ниже —
  `${POSTIZ_API_URL}/api/public/v1/...` (префикс `/api` обязателен, без него nginx
  редиректит на фронтенд → 307). Работает по https с любого устройства.
- **Organization.id:** `637b7803-9bd5-472e-ad37-cf2ce87ac773`.

## Архитектурное решение (итог долгих поисков)

**VK через Postiz НЕ работает из коробки** — его VK-провайдер постит на ЛИЧНУЮ
стену через VK ID OAuth (+ модерация scope `wall`, которую за час не пройти; gray
app-id типа VK Admin VK заблокировал). Поэтому:

- **VK = community-токен сообщества + НАШ патч провайдера** (постинг в стену
  сообщества). Клиент-онбординг: в 2 клика создаёт ключ сообщества (см. ниже).
- **Telegram = родной провайдер Postiz** (один бот-админ канала), без патча.
- **Instagram = НЕ в MVP** (Meta App Review + в РФ юридически токсично).

Конкуренты (SMMplanner/Postmypost) для VK используют OAuth личного аккаунта-админа
(один токен на все его группы + edit/delete), но это требует приложения. Мы
сознательно выбрали community-токен: проще для клиента, минус — **нельзя
редактировать/удалять опубликованное** (правки на стадии черновика).

## VK: что сделано и КАК устроено

### Патч провайдера
- Файл патча на сервере: **`/opt/postiz-official/patches/vk.provider.js`**
  (исходник для правок — `/tmp/vk.provider.patched.js` локально, но канон на сервере).
- Примонтирован поверх ДВУХ копий в контейнере (volumes в `docker-compose.trim.yaml`):
  `/app/apps/orchestrator/dist/.../social/vk.provider.js` и `/app/apps/backend/dist/.../social/vk.provider.js`.
- Суть патча: `post(groupId, token, …)` шлёт `wall.post` с `owner_id=-groupId`,
  `from_group=1`; **загрузка фото через messages-upload-сервер** (`getMessagesUploadServer`
  + `saveMessagesPhoto`, т.к. `getWallUploadServer` для group-auth = err 27);
  attachments по реальному (отрицательному) owner_id; `refreshToken` — no-op
  (community-токены бессрочные). `releaseURL = https://vk.com/wall-<groupId>_<postId>`.
- **Канон патча теперь завендорен в репо: `patches/vk.provider.js`** (раньше был
  только на сервере). При передеплое — этот файл монтируется поверх dist
  (orchestrator + backend), см. `docs/infra.md`.

### 🔑 КРИТИЧНО: Postiz хранит токены интеграций в ОТКРЫТОМ виде
- Не шифрует (в `integration.service` нет encrypt, в пост-флоу нет decrypt).
- Я сначала зашифровал токен функцией `encrypt_legacy_using_IV` → провайдер слал
  в VK шифр → `error_code 5 invalid access_token`. **Фикс: писать RAW токен.**
- (Есть `auth.service.js` с AES `encrypt/decrypt_legacy_using_IV` на JWT_SECRET — но
  это для другого, НЕ для Integration.token.)

### Зарегистрированный канал (рабочий, проверен)
- VK-сообщество **bit&pix**: integration id `c4665509-829c-4150-946e-f2b54f0da021`,
  `internalId=239528257` (group_id), `providerIdentifier='vk'`, `type='social'`,
  `token` = СЫРОЙ `VK_COMMUNITY_TOKEN` (из `.env`).
- Регистрация = INSERT в таблицу `Integration` (обязательные NOT NULL: id, internalId,
  organizationId, name, providerIdentifier, type, token — остальное по дефолтам).
- ✅ **Проверено боем:** `POST /api/public/v1/posts type=now settings.__type=vk` →
  опубликовано на стене: `https://vk.com/wall-239528257_2`.

### VK community-токен — что умеет (уточнено 14.06, проверено боем)
- ✅ `wall.post` (постинг в стену сообщества, текст) — РАБОТАЕТ.
- ✅ **Фото на стену (карусель)** — РАБОТАЕТ, но через **messages**-upload-сервер:
  `photos.getMessagesUploadServer(group_id)` → upload → `photos.saveMessagesPhoto`
  → `owner_id=-<groupId>` → attach `photo-<groupId>_<id>` в `wall.post`.
  ⚠️ Прямой `photos.getWallUploadServer`/`saveWallPhoto` community-токену **закрыты**
  (`error_code 27`) — на этом падала публикация мультифото (`wall-239528257_3` —
  первый успешный фото-пост после фикса патча). См. `patches/vk.provider.js`.
- ❌ `wall.get`, `wall.delete`, `wall.edit` — `error_code 27`. Читать/удалять стену
  community-токеном нельзя. `VK_SERVICE_TOKEN` тоже не читает (`wall.getById` →
  `error_code 1051` profile type) — проверять публикацию глазами/в Postiz по `releaseURL`.
- Токен в `.env`: `VK_COMMUNITY_TOKEN` (vk1.a.…, 220 симв), `VK_GROUP_ID=239528257`,
  права: wall+manage+photos+messages+docs.

### Онбординг клиента (VK) — инструкция в 2-3 клика
1. Админ сообщества открывает (десктоп): `https://vk.com/club<GROUP_ID>?act=tokens`
   (меню «Работа с API» VK прячет — нужна прямая ссылка; group_id из `vk.com/clubXXXX`).
2. «Создать ключ» → права **Стена, Фотографии, Управление** → скопировать (`vk1.a.…`).
3. Прислать нам → регистрируем как VK-канал в Postiz (INSERT, RAW токен).

## Telegram: РАБОЧИЙ (15.06.2026)

> ✅ Проверено боем: текст и карусель (3 фото) уходят в канал. Постинг-канал —
> регистрируется через `onboard-service` (как и VK). Egress-фикс контейнера
> Postiz — `docs/infra.md` → секция «Postiz → Telegram egress». Кратко: в env
> `postiz` добавлены `TELEGRAM_TOKEN` + `HTTPS_PROXY` (TG-провайдер на
> `node-telegram-bot-api`/`request` уважает env-прокси) + `NO_PROXY` с VK-доменами
> (VK-аплоад фото на Axios — его прокси ломал, держим напрямую).

- Postiz Telegram-провайдер использует **ОДИН бот из env `TELEGRAM_TOKEN`**
  (бот `bit_and_pix_bot`; теперь задан в env контейнера `postiz`).
- Наш бот: **`bit_and_pix_bot`** (id 8961639936), токен = `TELEGRAM_BOT_TOKEN` в `.env`.
- `authenticate(code=chatId/username)` делает `getChat`, возвращает
  `id = username || chat.id`, `accessToken = String(chat.id)`, `name = title`.
  → регистрация канала = INSERT integration: `providerIdentifier='telegram'`,
  `internalId` = username или chat_id, **`token` = String(chat_id)**, name=title.
- Штатный connect-флоу: в канал шлют `/connect <code>`, бот-админ ловит через
  getUpdates. Но мы можем зарегать напрямую (INSERT, token=chat_id), бот уже админ.
- **Тестовый канал для подключения:** «тестовый» (приватный), `chat_id=-1004375691069`,
  бот = админ (getChat ok). Это задача «Claude сам добавляет источник».

## Реальные посты с фото (для теста карусели)

- В репо только тексты + рендер-шаблоны; готовые картинки рендерятся в S3 (bucket=seo).
- Готовые слайды в S3: **`Sparta/posts/drafts/23_05_2026-1/slide_01.png` и `slide_02.png`**
  (1.5M / 1.3M) — годятся для multi-photo теста.
- S3-тул: `node tools/s3.mjs <list|get|url|put|rm|exists>`; `s3.mjs url <key>` → URL.
- Медиа в Postiz: загрузить через `/api/public/v1/upload-from-url` (отдаёт media {id,path}),
  затем в посте `value[].image=[{id,path}]`. VK-провайдер сам фетчит по path и грузит в VK.

## Грабли окружения (чтобы не терять время)

- **SSH основного сервера: порт 22** (24822 закрыт). Часто рвёт коннект на kex
  (fail2ban от частых коннектов) → пауза + retry.
- **Прокси allow-лист:** только `127.0.0.1, 178.253.42.36, 5.42.117.201`. С локальной
  машины прокси НЕ доступен. **Telegram API — только с сервера** (с локали режется).
  **VK API (`api.vk.com`) — доступен и с локали напрямую.**
- **Скобки `()` в grep/echo ломают удалённый bash через ssh** — длинные команды
  слать скриптом через stdin: `cat local.sh | ssh '...cat > /tmp/x.sh' && ssh 'bash /tmp/x.sh'`.
- Долгие операции (pull/certbot) **осиротевают по ssh-таймауту** → `nohup+лог+опрос`
  или server-side `timeout`. certbot: НЕ параллелить (глобальный lock), `--dry-run`
  ходит в staging и виснет — проверять `--force-renewal` (см. infra.md).
- Postiz API создать пост: `POST /api/public/v1/posts` body `{type, date(ISO), shortLink,
  tags, posts:[{integration:{id}, value:[{content, image:[]}], settings:{__type:"vk"}}]}`.
  `type`: now|schedule|draft. Для VK `settings.__type="vk"`.

## ЧТО ДАЛЬШЕ (следующие шаги)

1. ✅ **Multi-photo VK пост — СДЕЛАНО (14.06):** Sparta 23_05 slide_01/02.png →
   `s3.mjs url` → `upload-from-url` ×2 → пост с `image[]` + текст → `type=draft` →
   человек нажал publish → `wall-239528257_3` (карусель). Потребовал фикс патча
   (messages-upload, см. выше).
2. ✅ **Telegram — СДЕЛАНО 15.06.2026.** `TELEGRAM_TOKEN`+прокси добавлены в env
   `postiz`, канал регистрируется через `onboard-service`, тест поста
   `settings.__type="telegram"` (текст + карусель) долетел в канал. Детали egress —
   `docs/infra.md` (секция «Postiz → Telegram egress»).
3. **Демо approve-флоу:** `type=draft` → оператор в UI Postiz жмёт Publish → летит.
4. **Снести 2 тестовых поста** на стене bit&pix (id 1,2) — community-токен не умеет
   delete; нужно руками или user-токеном админа.
5. **Оформить онбординг-тул:** скрипт `register-channel` (VK: RAW community-токен;
   TG: chat_id) — чтобы подключение клиента было одной командой.

## Тупик, который НЕ повторять
- User-токен VK (covers all admin groups + edit/delete) — нужен OAuth, scope `wall`
  гейтится модерацией (~3 дня, паспорт), gray app-id (VK Admin 6121396 и пр.) VK
  заблокировал. Для MVP не лезть — community-токен решает.
- VK ID OAuth redirect настраивается в `id.vk.ru/about/business/go` → «Подключение
  авторизации» (НЕ в dev.vk.com «Размещение»). `VK_SECRET` Postiz НЕ использует (PKCE).
  Это всё не нужно при community-токене.
