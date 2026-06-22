# Онбординг и правка клиента без SSH — дизайн

> Спека от 14.06.2026. Цель: оператор с любого устройства, запустив Claude Code,
> заводит и правит клиента **полностью через HTTPS/локальные тулы — без ssh и без
> ручной хирургии в БД**. Опирается на ручной SOP `docs/client-onboarding.md`
> (он остаётся как процесс), но превращает шаги 2/3/5 в воспроизводимые тулы.

## 1. Цель и не-цели

**Цель.** Три операции, доступные оператору без доступа к серверу:
1. **Завести клиента** — скелет `projects/{ProjectID}/` + карточка/план в Notion +
   подключение соцканалов клиента в Postiz.
2. **Править клиента** — поля карточки Notion + локальные файлы проекта
   (`overrides.md` — «запомни / так не делай»).
3. **Подключать каналы** — VK (community-токен) и Telegram (канал бот-админа) в
   Postiz, **без ssh/psql**.

**Не-цели (YAGNI).**
- Google Drive — отменён, медиа в S3 (`docs/storage.md`). Поля Notion «… (Drive)» —
  легаси-нейминг, держат S3-ссылку; не переименовываем в этой спеке.
- Instagram / MAX публикация — не в MVP Postiz (см. `docs/postiz-integration.md`).
  В Notion платформы выбираются, но регистрируются только VK/Telegram.
- Веб-админка/логины для операторов — overkill. Интерфейс оператора = Claude Code.
- Механизм раздачи секретов — не нужен (см. §3).

## 2. Актёры

| Актёр | Доступ | Как работает |
|-------|--------|--------------|
| **Оператор** | Claude Code + 2 ключа (`NOTION_TOKEN`, `ONBOARD_API_KEY`) | Гоняет тулы `tools/onboard/*` локально; они ходят по HTTPS. **Сервера не видит.** |
| **Разработчик** | ssh к серверу | Один раз разворачивает `onboard-service`. Дальше не нужен. |
| **Клиент** | — | Присылает свой VK community-токен / добавляет нашего бота в TG-канал. |

## 3. Модель секретов

Оператору руками выдаём **ровно два ключа**, он кладёт их в локальный `.env`:
- `NOTION_TOKEN` — internal integration secret (карточки/планы/посты).
- `ONBOARD_API_KEY` — bearer к серверному `onboard-service` (регистрация каналов).

**Токены соцсетей клиента оператор не хранит.** VK community-токен / TG chat_id
собираются в момент онбординга, уходят в `onboard-service` → пишутся в БД Postiz.
Дальше Claude публикует, ссылаясь на канал по `integrationId`; реальные токены
держит Postiz. Раздавать/синхронизировать секреты между устройствами не нужно —
новый оператор просто получает эти два ключа.

## 4. Архитектура

```
ОПЕРАТОР (любое устройство, без ssh)
  Claude Code
   ├─ tools/onboard/new-client.mjs ─┐
   ├─ tools/onboard/edit-client.mjs ─┼─► локальная ФС: projects/{ID}/
   │                                 └─► Notion API  (NOTION_TOKEN)
   └─ tools/onboard/register-channel.mjs ─► HTTPS ─► onboard-service
                                                        (ONBOARD_API_KEY)
СЕРВЕР 5.42.117.201 (ставит разработчик 1 раз)
  nginx https://tech.bitandpix.ru/onboard/*  ──►  onboard-service (Node, :4010)
                                                    └─► Postgres Postiz (INSERT Integration)
```

Общий модуль `tools/lib/notion.mjs` — тонкая обёртка Notion REST (без SDK-зависимости,
на `fetch`, как уже принято в репо).

## 5. Компоненты

### 5.1 `tools/lib/notion.mjs` (общий)
Чистый `fetch`-клиент. Функции:
- `findClientByProjectId(projectId)` — query базы clients по `Local project ID`
  (фильтр rich_text equals) → страница или `null`. Ключ идемпотентности.
- `createClient({name, projectId, platforms[], operator, focus, status})` → page.
- `updateClient(pageId, patch)` — частичное обновление свойств.
- `createPlan({clientPageId, name, period, status})` → page (опционально на старте).
- Низкоуровневое `notion(method, path, body)` с заголовками
  `Authorization: Bearer`, `Notion-Version: 2022-06-28`.

Свойства баз (сняты с боевых баз 14.06.2026):

**clients:** `Name`(title) · `Local project ID`(rich_text, **ключ**) ·
`Платформы`(multi_select: VK/Instagram/MAX/Telegram) · `Оператор`(rich_text) ·
`Текущий фокус`(rich_text) · `Статус`(select: active|paused) · `Папка Drive`(url→S3).

**plans:** `Name`(title) · `Клиент`(relation→clients) · `Период`(rich_text) ·
`Статус`(select: черновик|на согласовании у клиента|утверждён|в работе|закрыт) ·
`PDF`(url) · `Заметки / ОС`(rich_text).

(базы posts тул сейчас не пишет — строки-посты заводит контент-флоу, не онбординг.)

### 5.2 `tools/onboard/new-client.mjs`
CLI:
```
node tools/onboard/new-client.mjs \
  --id BeautyCulture_DariaSopkina --name "Beauty Culture" \
  --platforms VK,Telegram --operator "Настя" --focus "запуск, сентябрь" \
  [--no-plan]
```
Шаги (идемпотентно):
1. **Валидация `--id`**: транслит без пробелов, `[A-Za-z0-9_]+`. Если
   `projects/{id}/` уже есть — не перезаписывать, предупредить.
2. **Скелет**: скопировать `projects/_template/` → `projects/{id}/`
   (context/voice?/strategy/overrides/content-plan + analytics/ feedback/).
   _template сейчас без `voice.md` — создать пустой `voice.md` с шапкой.
3. **Notion**: `findClientByProjectId(id)`; если нет — `createClient(...)`.
   Если есть — сообщить «уже заведён», вернуть ссылку, ничего не дублировать.
4. **План** (если не `--no-plan`): `createPlan` со статусом `черновик`,
   period = пусто/текущий месяц.
5. Записать `projects/{id}/channels.json` = `{notionClientPageId, channels:[]}`
   (реестр для register-channel и публикации).
6. Вывести сводку: пути, ссылку на карточку Notion, что делать дальше
   (бриф, каналы).

### 5.3 `tools/onboard/edit-client.mjs`
CLI:
```
node tools/onboard/edit-client.mjs --id BeautyCulture_DariaSopkina \
  --set focus="осенняя акция" status=paused operator="Лиза" \
  [--platforms VK,Telegram,MAX] \
  [--remember "не использовать жёлтый фон"]
```
- `--set` → `updateClient` соответствующих свойств (focus/status/operator).
- `--platforms` → перезапись multi_select.
- `--remember` → дописать строку в `projects/{id}/overrides.md` (раздел
  «Запомни / так не делай») + закоммитить локально не делаем (коммит — отдельно,
  как везде в репо: тул только меняет файл).
- Все правки идемпотентны; перед изменением читает текущее состояние.

### 5.4 `tools/onboard/register-channel.mjs`
CLI:
```
# VK community-токен:
node tools/onboard/register-channel.mjs --id <ProjectID> \
  --type vk --group-id 239528257 --token vk1.a.XXXX --name "Beauty Culture VK"

# Telegram (бот bit_and_pix_bot уже админ канала):
node tools/onboard/register-channel.mjs --id <ProjectID> \
  --type telegram --chat-id -1004375691069 --name "Beauty Culture TG"
```
- POST `https://tech.bitandpix.ru/onboard/channels` с `Authorization: Bearer
  $ONBOARD_API_KEY`, телом (см. §6).
- При успехе — дописать `{integrationId, type, ...}` в
  `projects/{id}/channels.json`; вывести `integrationId` (его потом использует
  публикация в Postiz `settings.__type`).
- TG-предусловие: бот-админ канала (иначе сервис вернёт 422 с понятным текстом).

### 5.5 `onboard-service` (серверный, разворачивает разработчик)
Тонкий Node-сервис, контейнер в `docker-compose.trim.yaml` Postiz (общая docker-сеть
→ достаёт `postiz-postgres`). Слушает `:4010`, nginx проксирует `/onboard/*`.
Авторизация: bearer `ONBOARD_API_KEY` (env сервиса). Подключение к БД — по
`DATABASE_URL` Postiz (та же строка, что у бэкенда).

Зачем сервис, а не Postiz API: public API Postiz **не создаёт интеграции** с сырым
токеном (только OAuth через UI). Наши VK-community / TG-direct флоу = прямой
`INSERT` в таблицу `Integration`. Сервис инкапсулирует этот INSERT и грабли
(RAW-токен — Postiz хранит токены **в открытом виде**, шифровать нельзя; NOT NULL
поля) в одном проверенном месте.

## 6. Контракт onboard-service

### `POST /onboard/channels`
Body (VK):
```json
{ "projectId":"BeautyCulture_DariaSopkina", "type":"vk",
  "name":"Beauty Culture VK", "vk":{ "groupId":239528257, "token":"vk1.a.XXXX" } }
```
Body (Telegram):
```json
{ "projectId":"...", "type":"telegram", "name":"Beauty Culture TG",
  "telegram":{ "chatId":-1004375691069 } }
```
Логика INSERT в `Integration` (из `docs/postiz-integration.md`):
- общие: `id`=uuid, `organizationId`=fixed (env `POSTIZ_ORG_ID`
  =`637b7803-9bd5-472e-ad37-cf2ce87ac773`), `name`, `type`='social',
  `providerIdentifier`, `token` (**RAW**), дефолты на остальное.
- **vk**: `providerIdentifier`='vk', `internalId`=String(groupId),
  `token`=RAW vk-токен. (Перед записью — проба `wall.post`-прав не делаем; токен
  валидируем лёгким `groups.getById`/`users.get` через `api.vk.com` — доступен и с
  сервера. Невалидный → 422.)
- **telegram**: `providerIdentifier`='telegram', `internalId`=String(chatId),
  `token`=String(chatId). Предусловие — `getChat` ботом (`TELEGRAM_TOKEN` env
  сервиса) возвращает ok и бот админ; иначе 422.
- **Идемпотентность**: уникальность по `(organizationId, providerIdentifier,
  internalId)`. Если интеграция есть — **UPDATE токена/имени**, вернуть тот же
  `integrationId` (не плодить дубли).

Ответ: `200 {"integrationId":"...", "providerIdentifier":"vk", "internalId":"239528257", "updated":false}`.
Ошибки: `401` (нет/битый bearer), `422` (невалидный токен / бот не админ / плохой
body) с полем `error` человекочитаемым, `500` (БД).

### `GET /onboard/channels?projectId=` (опц.)
Список интеграций по `internalId`, известным из `channels.json` оператора, либо по
организации. Нужен для проверки/идемпотентности. Низкий приоритет.

### `DELETE /onboard/channels/:integrationId` (опц., низкий приоритет)
Удалить интеграцию (для перезаведения). Не обязателен в MVP.

## 7. Идемпотентность и ошибки

- **new-client**: ключ — `Local project ID` в Notion + наличие `projects/{id}/`.
  Повторный запуск ничего не дублирует, сообщает текущее состояние.
- **register-channel**: ключ — `(org, provider, internalId)` на стороне сервиса.
- **Сетевые**: тулы выводят понятную ошибку и код; не «глотают» 4xx/5xx.
- **Без коммитов**: тулы меняют файлы/Notion, но **git commit/push не делают** —
  как требует CLAUDE.md (коммит только с подтверждения оператора).

## 8. Тестирование

- `tools/lib/notion.mjs` — юнит на сборку тела свойств (mapping → Notion payload)
  с замоканным `fetch`.
- `new-client` / `edit-client` — прогон против **тестовой** карточки в Notion
  (базы под страницей «Тест» в `config/notion.json`), затем удалить страницу.
  Проверка идемпотентности: двойной запуск.
- `onboard-service` — локально на сервере: регистрация тестового VK (group 239528257,
  токен из `.env`) + TG («тестовый» канал −1004375691069), `type=now` пост через
  Postiz → проверить публикацию (как в §«ЧТО ДАЛЬШЕ» постиз-доки).
- Идемпотентность сервиса: повторная регистрация → `updated:true`, тот же id.

## 9. Деплой серверной части (разработчик, один раз)

1. `tools/onboard-service/` (server.mjs + Dockerfile + package.json) — добавить
   сервисом в `/opt/postiz-official/docker-compose.trim.yaml` (та же сеть, env:
   `DATABASE_URL`, `POSTIZ_ORG_ID`, `ONBOARD_API_KEY`, `TELEGRAM_TOKEN`,
   `VK_SERVICE_TOKEN` для валидации).
2. nginx `tech.bitandpix.ru`: `location /onboard/ { proxy_pass http://127.0.0.1:4010/; }`.
3. Сгенерировать `ONBOARD_API_KEY`, положить в env сервиса и выдать операторам.
4. Smoke: `curl -H "Authorization: Bearer …" .../onboard/channels` (GET) → 200.

## 10. Риски и открытые вопросы

- **Схема таблицы `Integration`**: набор NOT NULL/дефолтов проверить на боевой БД
  перед финалом INSERT (в постиз-доке перечислены обязательные; остальные —
  дефолты, подтвердить `\d "Integration"`).
- **Notion rate limit** (~3 rps) — онбординг редкий, не проблема; батчей нет.
- **Тестовые vs боевые базы Notion**: сейчас `config/notion.json` под страницей
  «Тест». Перед продакшеном — переключить на боевую страницу и обновить id.
- **Валидация VK-токена**: community-токен умеет `wall.post`, но `groups.getById`
  под ним может вернуть ok без wall-прав — валидация подтверждает «токен живой»,
  не «есть права постинга». Полная проверка прав — первый тестовый пост.
