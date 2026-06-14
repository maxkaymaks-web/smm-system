# Онбординг клиента без ssh — что сделано и зачем (хэндофф 14.06.2026)

> Для проверки после `/clear`. Что построено, зачем, как устроено, **как проверить**.
> Полный дизайн — `docs/superpowers/specs/2026-06-14-client-onboarding-no-ssh-design.md`,
> план — `docs/superpowers/plans/2026-06-14-client-onboarding-no-ssh.md`,
> инфра — `docs/infra.md` (секция onboard-service), флоу — `docs/client-onboarding.md`.

## Зачем (задача)

Операторы должны заводить/править клиентов и подключать их соцсети **с любого
устройства, без ssh и без доступа к серверу**. Раньше подключение канала в Postiz
делалось руками — `INSERT` в БД через ssh+psql (антипаттерн прошлой сессии).
Цель: всё через локальные тулы + HTTPS. Оператору на руки — только 2 ключа
(`NOTION_TOKEN`, `ONBOARD_API_KEY`); токены соцсетей живут в Postiz, оператор их
не видит. Google Drive из охвата выкинут (остаёмся на S3).

## Что построено

**Операторские тулы (локальные `.mjs`, чистый HTTPS, в репо):**
- `tools/onboard/new-client.mjs` — заводит клиента: скелет `projects/{id}/` из
  `_template` + карточка в базе Notion «Клиенты» (+ план-черновик) + `channels.json`.
- `tools/onboard/edit-client.mjs` — правит поля карточки Notion (`--status/--operator/
  --focus/--platforms`) + дозапись «запомни/так не делай» в `overrides.md` (`--remember`).
- `tools/onboard/register-channel.mjs` — подключает VK/TG канал клиента в Postiz
  через серверный сервис; пишет `integrationId` в `projects/{id}/channels.json`.
- `tools/lib/notion.mjs` — обёртка Notion REST (билдеры свойств + операции).
  **Важно:** снимает `*_PROXY` из env (tinyproxy режет Notion по allow-листу) —
  иначе тулы не работали бы с устройств с прокси в `.env`.

**Серверный сервис (развёрнут на проде 5.42.117.201, в Docker рядом с Postiz):**
- `tools/onboard-service/` (server.mjs + Dockerfile + package.json) — тонкий
  HTTP-сервис. Делает `INSERT/UPDATE` в таблицу `Integration` Postiz (public API
  Postiz так не умеет). Слушает `127.0.0.1:4010`, nginx отдаёт `https://
  tech.bitandpix.ru/onboard/`. Auth — `Authorization: Bearer $ONBOARD_API_KEY`.
  - `POST /onboard/channels` (vk: `{groupId,token}` / telegram: `{chatId}`) →
    `{integrationId, name, updated}`. Идемпотентно по
    `(organizationId, providerIdentifier, internalId)`.
  - `GET /onboard/channels` → список интеграций.
  - Токен пишется в Postiz **СЫРЫМ** (Postiz не шифрует — это by design).

**Маппинг клиент→канал:** `projects/{id}/channels.json` хранит `integrationId`.
Публикация — штатным Postiz public API по этому id (флоу не менялся).

## Как устроен полный флоу

```
ЗАВЕСТИ:     new-client.mjs  → файлы в репо + карточка Notion (Notion API, прямой HTTPS)
ПОДКЛЮЧИТЬ:  register-channel.mjs → HTTPS → onboard-service (:4010) → INSERT в БД Postiz
ОПУБЛИКОВАТЬ: Postiz public API (upload-from-url ×N → /posts, settings.__type) — без изменений
СЕКРЕТЫ:     у оператора — NOTION_TOKEN + ONBOARD_API_KEY; токены соцсетей — в Postiz
```

## Как проверить (после clear)

```bash
cd ~/projects/smm-system

# 1. Юнит-тест обёртки Notion
node --test tools/lib/notion.test.mjs            # 3/3 pass

# 2. Сервис жив (публичный HTTPS, ключ — в локальном .env ONBOARD_API_KEY)
KEY=$(grep ^ONBOARD_API_KEY= .env | cut -d= -f2-)
curl -s -H "Authorization: Bearer $KEY" https://tech.bitandpix.ru/onboard/channels   # {"channels":[…bit&pix vk…]}
curl -s -o /dev/null -w "%{http_code}\n" https://tech.bitandpix.ru/onboard/channels   # 401 (без ключа)

# 3. End-to-end без ssh на временном проекте (потом прибрать)
VKT=$(grep ^VK_COMMUNITY_TOKEN= .env | cut -d= -f2-)
node tools/onboard/new-client.mjs --id ZZ_Check --name "ZZ" --no-plan
node tools/onboard/register-channel.mjs --id ZZ_Check --type vk --group-id 239528257 --token "$VKT"
cat projects/ZZ_Check/channels.json     # integrationId=c4665509-…, name=vk-239528257
# повтор той же команды → "обновлён", тот же id (идемпотентность)
rm -rf projects/ZZ_Check                # + архивировать карточку «ZZ» в Notion-UI
```

## Состояние на сервере (развёрнуто, бэкапы есть)

- `/opt/postiz-official/onboard-service/` + сервис `onboard-service` в
  `docker-compose.trim.yaml` (сеть `postiz-network`, env: ONBOARD_API_KEY,
  DATABASE_URL, POSTIZ_ORG_ID, TELEGRAM_TOKEN).
- nginx `tech.bitandpix.ru`: `location /onboard/` → `:4010`. Бэкапы compose/nginx —
  `*.bak.<ts>` рядом. SSH-порт основного сервера — **22** (не 24822).

## Открытые / не делалось (осознанно)

- **Боевую публикацию** через зарегистрированный канал не гонял — это существующий
  флоу Postiz (уже проверен в прошлой сессии: `wall-239528257_2`), мой код его не
  трогал; community-токен не умеет удалять → не сорил в живую стену.
- **Telegram-регистрацию** end-to-end вживую не гонял (бот должен быть админом
  канала; код + валидация `getChat` готовы, `chat-id` принимает и `-100…`, и `@username`).
- **Не пушил в origin** — `main` смержен локально (merge-commit `4e7f283`), пуш ждёт
  твоего «да».
- Notion-базы пока под тестовой страницей «Тест» (`config/notion.json`) — перед
  продом переключить на боевую страницу.

## Git

`main`, 11 коммитов фичи под merge-commit `4e7f283`. Ветка `claude/onboarding-no-ssh`
смержена и удалена. Локальный `.env` дополнен `ONBOARD_API_URL` + `ONBOARD_API_KEY`
(gitignored).

---

## ✉️ Записка следующей сессии (14.06, вечер) — для e2e после /clear

**Контекст:** оператор тестировал систему «глазами нового пользователя» (поставил
репо, какие ключи нужны). По дороге нашли и починили пробелы. E2e договорились
гонять в **следующей сессии** (оператор после /clear пришлёт мне эти сообщения).

**Что сделано в этой сессии (всё в коммите `855b5ca`, кроме gitignored-файлов):**
- **POSTIZ URL разрулён.** Правильный публичный эндпоинт — `https://tech.bitandpix.ru`
  + путь `/api/public/v1/...` (**префикс `/api` обязателен**; без него nginx 307 на
  фронтенд — на это убил время, не повторять). Работает по https с любого устройства,
  `:4007` наружу НЕ нужен. Проверено: `GET …/api/public/v1/integrations` +ключ → 200,
  без ключа → 401.
- **`.env.operator`** (в корне, gitignored) — раздаточный набор операторских секретов:
  `NOTION_TOKEN, ONBOARD_API_KEY, POSTIZ_API_KEY, FAL_KEY, APIFY_TOKEN, APIFY_USER_ID,
  S3_ACCESS_KEY, S3_SECRET_KEY` + URL-константы. **VK не включён** (по решению оператора).
  Оператор делает `cp .env.operator .env`. Админские ключи (`*_ADMIN_PASSWORD`,
  `GITHUB_PAT`, `TELEGRAM_BOT_TOKEN`, `VK_*`, `LITELLM_*`) сознательно НЕ раздаём.
- **Доки доведены:** `.env.example` (+POSTIZ блок), `access-setup.md` (ключи онбординга/
  публикации + кому давать/не давать), `postiz-integration.md` (пути → `/api/public/v1`).

**Что осталось (начать отсюда):**
1. **E2e без ssh** — полный флоу как новый оператор: `new-client` → `register-channel`
   (vk, group 239528257) → **реальная публикация** через Postiz API
   (`POST $POSTIZ_API_URL/api/public/v1/posts`, `settings.__type=vk`). Оператор выбрал
   охват «+ реальная публикация» — нужен канал, не жалко стены. Прибрать тестовый
   проект после (`rm -rf projects/ZZ_*` + архивировать карточку в Notion).
2. **Пуш в origin** — `main` на **14 коммитов** впереди `origin/main`, пуш ждёт явного
   «да» оператора (правило репо: не пушить автоматически).

**Полезное для e2e:** Notion на тестовой странице «Тест» (`config/notion.json`) — прод
не заденем. Раздел «Как проверить» выше — готовые команды. Команда быстрой проверки
сервиса публикации: `curl -H "Authorization: $POSTIZ_API_KEY" $POSTIZ_API_URL/api/public/v1/integrations`.
