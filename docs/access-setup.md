# Доступы и креды — Notion + медиа (S3)

Для того, кто настраивает систему (разработчик/начальник). Креды → `.env` (gitignored),
раздаются операторам по защищённому каналу, не в открытых чатах. ID баз Notion — **не
секрет**, лежат открыто в `config/notion.json`.

---

## 🟧 Notion (Internal Integration Secret)

Claude Code работает с Notion через **внутреннюю интеграцию** (один общий секрет на
команду). Этот же секрет питает локальный Notion MCP-сервер.

### Шаг 1. Создать интеграцию (один раз)
1. [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New
   integration** → имя `smm-system`, выбрать рабочее пространство → Submit.
2. Скопировать **Internal Integration Secret** (`ntn_…` / `secret_…`).

### Шаг 2. Расшарить нужные страницы/базы
- На родительской странице (под ней — базы «Клиенты»/«Планы»/«Посты»):
  **••• (вверху справа) → «Соединения» (Connections) → добавить** интеграцию `smm-system`.
- Доступ наследуется вниз: всё, что создано под этой страницей, видно интеграции.
  Что не расшарено — Claude Code не видит.

### Что попадает в `.env`
```
NOTION_TOKEN=<Internal Integration Secret>
```
ID баз — открыто в `config/notion.json` (`clients`/`plans`/`posts`). Базы созданы
(14.06.2026) под страницей «Тест»; на боевой странице — обновить config.

**Notion MCP в Claude Code.** Репо содержит `.mcp.json` (сервер `notion` через
`npx @notionhq/notion-mcp-server`, токен — `${NOTION_TOKEN}`). Чтобы Claude Code
подставил токен, переменная должна быть **в окружении** при запуске `claude` —
`.env` сам по себе в шелл не экспортируется. Перед запуском:
```bash
set -a; source .env; set +a
claude        # при первом старте подтвердить project-scoped MCP-сервер notion
```
Проверка статуса — команда `/mcp` внутри сессии.

---

## 🟩 Онбординг каналов + публикация (ключи сервисов)

Без этих двух ключей оператор не подключит соцсети клиента и не опубликует пост.
Оба — секреты, раздаются операторам тем же защищённым каналом, что и Notion.

```
ONBOARD_API_KEY=<секрет сервиса онбординга>     # подключение VK/TG каналов (register-channel)
POSTIZ_API_KEY=<Organization.apiKey из Postiz>   # публикация поста (Postiz public API)
```

- **`ONBOARD_API_KEY`** — задаётся в env контейнера `onboard-service` на сервере
  (`ONBOARD_API_KEY`). Тот же ключ кладётся операторам. URL сервиса — константа
  `ONBOARD_API_URL=https://tech.bitandpix.ru/onboard` (не секрет, уже в `.env.example`).
- **`POSTIZ_API_KEY`** — это `Organization.apiKey` из БД Postiz (UI: Settings → API).
  URL — константа `POSTIZ_API_URL=https://tech.bitandpix.ru` (host без `/api`);
  эндпоинты — `${POSTIZ_API_URL}/api/public/v1/...`. Работает по https с любого
  устройства (см. `docs/postiz-integration.md`).

> Готовый раздаточный набор всех операторских секретов одним файлом —
> сгенерировать из боевого `.env` и передать как `.env` оператору (см. «Кому
> передать креды»). Файл `.env.operator` в `.gitignore` — в репозиторий не попадает.

---

## 🟦 Медиа — S3 Timeweb

Медиа (рендеры, картинки, PDF, видео) лежат в **S3** (бакет `seo`, префикс `smm/`).
Полный гайд — `docs/s3.md`. Креды в `.env`:
```
S3_ENDPOINT=https://s3.twcstorage.ru
S3_BUCKET=seo
S3_REGION=ru-1
S3_ACCESS_KEY=…
S3_SECRET_KEY=…
```
- **Директору** для просмотра/докидывания файлов — **Cyberduck** или веб-панель Timeweb
  (см. `docs/s3.md`, «Способ 2 — GUI»). Бакет монтируется как папка, drag-and-drop.
- **Клиентам** — presigned-ссылки: `node tools/s3.mjs url <ключ>`.

> Google Drive рассматривали и **отказались** (14.06.2026): сервис-аккаунты не пишут в
> личный My Drive, Workspace не оплатить из РФ, личный OAuth — хрупко. Детали — `docs/storage.md`.

---

## Кому передать креды

**Сначала — разработчику** (настроить/проверить). **Потом — операторам.**

Оператору для полного флоу без ssh нужны секреты: `NOTION_TOKEN`, `ONBOARD_API_KEY`,
`POSTIZ_API_KEY`, `FAL_KEY`, `APIFY_TOKEN`/`APIFY_USER_ID`, `S3_ACCESS_KEY`/`S3_SECRET_KEY`.
URL-адреса сервисов и ID баз — константы (в `.env.example` / `config/notion.json`),
добывать не надо.

**НЕ передавать операторам** (админ/инфра): `*_ADMIN_PASSWORD` (Postiz/Chatwoot),
`GITHUB_PAT` (git-доступ личный у каждого), `TELEGRAM_BOT_TOKEN` (живёт на сервере),
`VK_COMMUNITY_TOKEN`/`VK_ID`/`VK_SECRET` (аккаунт bit&pix), `LITELLM_*`,
`OPENROUTER_*`, `OPENCLAW_*`. Поэтому боевой `.env` целиком отдавать нельзя.

Раздать удобно одним файлом: собрать `.env.operator` (только операторские секреты,
скопированные из боевого `.env`; он в `.gitignore`) и передать оператору — тот
переименует в `.env`: `cp .env.operator .env`. Шаблон полей — `.env.example`.
