# Инфраструктура bit&pix — серверы и egress

> ⚠️ **ТРАНЗИТ.** Инфра переезжает (Track 2, blue-green на свежий бокс + забор
> прод-IP) — актуальный план: `smm-app/docs/specs/2026-06-30-track2-infra-migration-runbook.md`.
> **Postiz и onboard-service выводятся** (публикация теперь руками); секции про них
> ниже — описание ТЕКУЩЕГО seo до миграции, после cutover устареют. Chatwoot и
> survey-service переезжают и остаются.
>
> Снято/проверено 12.06.2026. Секреты — **не** здесь, они в `.env` на серверах.
> Это dev-документ (инфра — зона разработчика).

## Серверы

| Роль | IP | SSH-порт | ОС | Ресурсы |
|------|----|---------:|----|---------|
| Основной «seo» (медиа/S3, сессии CC, кандидат под Postiz) | `5.42.112.17` | **22** | Ubuntu 24.04 | **1.9 GiB RAM**, 2 CPU, 38G диск (27G свободно) |
| Прокси-egress | `5.2.66.188` | **24822** | — | — |

⚠️ **SSH-порты разные:** основной — `22`, прокси — `24822`. (Глобальная заметка
«везде 24822» для основного сервера неверна.) Основной с некоторых IP роняет
коннект на этапе kex (fail2ban/whitelist) — заходить с доверенного IP.

## Прокси (tinyproxy на 5.2.66.188)

- `tinyproxy` слушает `:8888`, `Listen 0.0.0.0`
- **BasicAuth** (логин/пароль — в `.env` как `PROXY_URL`, формат
  `http://<user>:<pass>@5.2.66.188:8888`)
- CONNECT разрешён только на портах **443 / 563** (HTTPS-туннель)
- **Allow-лист по IP:** `127.0.0.1`, `178.253.42.36`, `5.42.112.17`
  (основной сервер уже включён). Новый клиент egress'а → добавить его IP в
  `/etc/tinyproxy/tinyproxy.conf` (`Allow <ip>`) и `systemctl reload tinyproxy`.
- Побочно на этом же хосте: `litellm-proxy` (Docker, `:4000`) + postgres —
  наследие OpenClaw, к постингу отношения не имеет.

## Egress: достижимость соцсетей (проверено curl-пробами 12.06.2026)

| Хост | Прямо с основного (RU) | Через tinyproxy |
|------|:----------------------:|:---------------:|
| `api.vk.com` | ✅ стабильно (и из контейнера) | ✅ |
| `api.telegram.org` | ⚠️ флапает (DPI режет часть DC; из контейнера `ETIMEDOUT`) | ✅ надёжно |
| `graph.facebook.com` (Meta/IG) | ✅ отвечает | ✅ |
| `platform-api.max.ru` | — | ✅ |

> Пробы подтверждают только TCP+TLS+HTTP-ответ до API-хоста, не реальную работу
> Bot/Graph-вызовов. **Уточнено 14.06:** Telegram прямым путём НЕнадёжен (RU-DPI
> таймаутит часть Telegram-DC по IP, DNS отдаёт их по кругу; из docker-контейнера
> особенно). Вывод: **к Telegram всегда через tinyproxy**, VK — напрямую. onboard-
> service так и сделан (`TELEGRAM_PROXY`+`ProxyAgent`, см. секцию ниже).

## Postiz (развёрнут 12.06.2026, работает)

- RAM **1.9 → 8 GiB** (делит сервер с Chatwoot-инбоксом) + **2G swap** (`/swapfile`).
- **Docker CE 29.5.3 + compose v5.1.4** (офиц. репозиторий).
- **Урезанный стек (путь A), 5 контейнеров**, в **`/opt/postiz-official/`**,
  файл **`docker-compose.trim.yaml`** (форк офиц. `docker-compose.yaml` из репо
  gitroomhq/postiz-docker-compose, выкинуты Elasticsearch + temporal-ui +
  admin-tools + spotlight):
  `postiz` (ghcr, образ **5.66 GB**) · `postiz-postgres` (17-alpine) ·
  `postiz-redis` (7.2) · `temporal` (auto-setup 1.28.1, **ENABLE_ES=false** →
  визибилити на Postgres) · `temporal-postgresql` (postgres:16).
- **UI/API:** **https://tech.bitandpix.ru** (через host-nginx, см. ниже).
  `/auth` → 200; публичный API `/api/public/v1/*` (для Claude). Контейнер также
  слушает `127.0.0.1:4007` (вход для nginx).
- **Админ:** `admin@bitpix.team` / `Tmp123456!` (SUPERADMIN, сменить в UI).
  `DISABLE_REGISTRATION=true` (после создания админа).
- **API-ключ Claude** = `Organization.apiKey` (авто-генерится). Лежит в репо `.env`
  как `POSTIZ_API_KEY` + `POSTIZ_API_URL`. Заголовок: `Authorization: <key>`
  (без Bearer). Проверено: `GET /api/public/v1/integrations` → 200.

### Грабли при установке (чтобы не повторять)

- **Текущий Postiz (v2.12+) тащит Temporal-стек**, старый лёгкий compose
  (postiz+pg+redis) НЕ работает — бэкенд крашится на коннекте к `temporal:7233`.
  Брать офиц. compose из репо `gitroomhq/postiz-docker-compose`.
- **Без Elasticsearch Temporal падает на регистрации search-attributes**:
  Postiz создаёт `organizationId`+`postId` как тип **Text**, а Postgres-визибилити
  лимитирован 3 Text-слотами → бэкенд не доходит до `listen(3000)` → `/api` 502.
  **Фикс (durable):** предсоздать оба атрибута как **Keyword** —
  `docker exec temporal temporal operator search-attribute create --address temporal:7233 --namespace default --name organizationId --type Keyword` (и `postId`),
  затем перезапустить `postiz`. Атрибуты живут в `temporal-postgres-data`.
- `:3002` внутри контейнера = health-порт **оркестратора**, не API. API-бэкенд =
  `:3000` (как и ждёт внутренний nginx). 502 был из-за краша бэкенда, не из-за порта.
- **Образ Postiz 5.66 GB** не проходит через tinyproxy. → daemon-прокси с
  `NO_PROXY=ghcr.io,pkg-containers.githubusercontent.com`: Docker Hub тянем через
  прокси (обход rate-limit), ghcr (Postiz) — напрямую.
  См. `/etc/systemd/system/docker.service.d/http-proxy.conf`.
- **SSH без pty не убивает удалённую команду по клиентскому таймауту** — длинные
  pull'ы осиротели (9 процессов, load 6.8). Долгие операции: `nohup+лог+опрос` или
  server-side `timeout`. Заливка файлов на сервер: `cat local | ssh 'cat > remote'`.

## Host-nginx (общий reverse-proxy + HTTPS) — 13.06.2026

- На хосте `5.42.112.17` стоит **nginx 1.24 + certbot 2.9** (НЕ в Docker).
  Это **общая точка входа** сервера на портах 80/443.
- Сайт `/etc/nginx/sites-available/tech.bitandpix.ru` → `proxy_pass 127.0.0.1:4007`
  (Postiz), websocket + `client_max_body_size 256m` (медиа).
- **Домен `tech.bitandpix.ru`** (A-запись → 5.42.112.17). **HTTPS Let's Encrypt**
  выпущен (до 2026-09-11, авто-renew через certbot timer). HTTP 80 → 301 на https.
- **Второй сервис — Chatwoot — уже на `chat.bitandpix.ru`** (отдельный server-блок
  + свой LE-серт, выпущен 13.06.2026 другим агентом, → Chatwoot `:3000`). Серт
  под тем же `certbot.timer`, продлевается автоматически.

### ⚙️ Перф-настройки nginx (gzip + HTTP/2) — 23.06.2026 (ВРУЧНУЮ, не в Docker)

> Жалоба: «Chatwoot и Postiz долго открываются». Диагностика: железо в норме
> (load <1, RAM свободна), бэкенды отвечают за 45–150 мс — тормозило **холодное
> скачивание фронтенд-ассетов**. Postiz уже был ок (его `_next`-ассеты Next.js
> сам отдаёт gzip + `immutable`-кэш на год). Виноват был nginx для Chatwoot.

Что включено вручную на сервере (`5.42.112.17`, файлы вне репо — **при передеплое
nginx восстановить руками**):

1. **gzip для статики** в `/etc/nginx/nginx.conf` — раньше `gzip on`, но `gzip_types`
   был закомментирован → жался **только** `text/html`, а JS/CSS шли сырыми.
   Раскомментировано + расширено: `gzip_vary on; gzip_proxied any;
   gzip_comp_level 5; gzip_min_length 1024;` и `gzip_types` с
   `application/javascript text/javascript text/css application/json
   image/svg+xml application/wasm` (+шрифты). Эффект: холодное открытие Chatwoot
   **19.2 MB → 5.0 MB** (−3.8×). На Postiz не влияет (его ассеты уже сжаты
   апстримом — nginx повторно не трогает уже закодированные ответы).

2. **HTTP/2** — `listen 443 ssl;` → **`listen 443 ssl http2;`** в
   `tech.bitandpix.ru` (строка `listen 443`). ⚠️ nginx **1.24** — синтаксис
   старый (`http2` в `listen`), НЕ `http2 on;` (это 1.25+, упадёт `unknown
   directive`). `chat.bitandpix.ru` **намеренно БЕЗ** `http2`: оба сайта на одном
   сокете `0.0.0.0:443`, опция протокола задаётся на сокет один раз → дубль даёт
   варнинг `protocol options redefined`. Проверка: `curl -o /dev/null -w
   "%{http_version}" https://chat.bitandpix.ru/` → `2`.

3. Применение: `nginx -t && systemctl reload nginx` (без даунтайма). Бэкапы
   конфигов на сервере: `*.bak.20260623-163547`.

Дальше (НЕ делали, на будущее): дробление 2.9 MB `dashboard.js` Chatwoot — это
**сборка их образа** (официальный `chatwoot/chatwoot:latest`, ассеты вшиты),
форк не оправдан. Если упрёмся — дешевле поставить **brotli**-модуль в nginx
(~+15% к gzip, без форков), чем лезть в их vite-билд.

### Сертификаты и автопродление (оба домена)

| Домен | Сервис | Серт истекает | Продление |
|-------|--------|---------------|-----------|
| `tech.bitandpix.ru` | Postiz | 2026-09-11 | `certbot.timer` (общий) |
| `chat.bitandpix.ru` | Chatwoot | 2026-09-11 | `certbot.timer` (общий) |

- Один `certbot.timer` (2×/сутки, Persistent) обслуживает **оба** серта; реальное
  продление ~за 30 дней до истечения, через nginx, без даунтайма. Подтверждено
  двумя успешными боевыми выпусками.

### ⚠️ Координация двух агентов на одном сервере (важно)

- **certbot нельзя запускать параллельно** — у него глобальный lock; одновременные
  запуски двух агентов падают с «Another instance is running» и могут вешать
  `--dry-run` в очереди. Серриализовать: убедиться `pgrep -f certbot` пуст перед стартом.
- **`--dry-run` ходит в LE staging** (регистрирует новый аккаунт) и на этом сервере
  подвисает; боевое продление идёт в production (аккаунт есть) и работает. Для проверки
  лучше `certbot renew --force-renewal`, а не `--dry-run`.
- Манульный certbot запускать с **снятым прокси**: `env -u HTTPS_PROXY -u HTTP_PROXY certbot ...`
  (интерактивный shell имеет `HTTPS_PROXY` → ACME через tinyproxy может зависнуть;
  systemd-таймер и так идёт direct).
- **SSH-обрывы на kex** у `5.42.112.17` учащаются при частых коннектах двух агентов
  (похоже fail2ban). Не молотить коннектами; при обрыве — пауза и retry.

## onboard-service (регистрация каналов без ssh) — 14.06.2026

Тонкий Node-сервис рядом с Postiz: регистрирует соцканал клиента в БД Postiz
(`INSERT/UPDATE` в таблицу `Integration`), т.к. public API Postiz создавать
интеграции с готовым токеном не умеет. Операторы дёргают его по HTTPS — **без ssh**.

- **Код:** в репо `tools/onboard-service/` (server.mjs + Dockerfile + package.json);
  на сервере развёрнут в `/opt/postiz-official/onboard-service/`, добавлен сервисом
  `onboard-service` в `docker-compose.trim.yaml` (сеть `postiz-network`,
  слушает `127.0.0.1:4010`, `depends_on: postiz-postgres healthy`).
- **nginx:** `location /onboard/` в сайте `tech.bitandpix.ru` → `127.0.0.1:4010`
  (вставлен перед `location /`). Публичный вход: `https://tech.bitandpix.ru/onboard/`.
- **Контракт:** `POST /onboard/channels` (vk: `{groupId,token}` / telegram:
  `{chatId}`) → `{integrationId, updated}`; `GET /onboard/channels`. Auth —
  `Authorization: Bearer $ONBOARD_API_KEY`. Идемпотентно по
  `(organizationId, providerIdentifier, internalId)`.
- **Секреты — в env сервиса (server-side, НЕ в git):** `ONBOARD_API_KEY`,
  `DATABASE_URL` (как у Postiz), `POSTIZ_ORG_ID=637b7803-…`, `TELEGRAM_TOKEN`
  (бот `bit_and_pix_bot`), **`TELEGRAM_PROXY`** (= аутентиф. tinyproxy
  `http://…@5.2.66.188:8888`; для egress к Telegram, см. ниже). Оператору в
  локальный `.env` — только `ONBOARD_API_URL` + `ONBOARD_API_KEY`. Токен пишется
  в Postiz **СЫРЫМ** (Postiz не шифрует).
- **Egress валидации (важно, проверено 14.06):** перед `INSERT` сервис валидирует
  токен в API соцсети. **VK** (`groups.getById`) — **напрямую**, стабильно.
  **Telegram** (`getChat`) — **через `TELEGRAM_PROXY`**: RU-DPI флапает прямой путь
  к Telegram-DC (часть IP таймаутит, особенно из docker-контейнера — `ETIMEDOUT`),
  через tinyproxy `getMe`/`getChat` = ok. Node `fetch`/undici **env-прокси
  игнорирует** → в `server.mjs` явный `undici.ProxyAgent` только для TG-вызова
  (оттого `undici` в `package.json` сервиса). VK через прокси не гоняем.
- **Операторские тулы:** `tools/onboard/{new-client,edit-client,register-channel}.mjs`
  (флоу — `docs/client-onboarding.md`). Тулы снимают `*_PROXY` из env (tinyproxy
  режет Notion/наш сервис по allow-листу) → работают с любого устройства.
  `register-channel` принимает отрицательный `--chat-id -100…` (TG-каналы) —
  argv нормализуется внутри (Node `parseArgs` иначе падает на «похоже на флаг»).
- **Деплой повторно:** `tar`-залить `tools/onboard-service` в `/opt/postiz-official/`
  → `docker compose -f docker-compose.trim.yaml up -d --build onboard-service`
  (`--build` обязателен — иначе не подтянется новый `undici`). Вставки в
  compose/nginx идемпотентны; перед reload — `nginx -t`. Бэкапы `.bak.<ts>`.

## Postiz → Telegram egress (решено 15.06.2026)

Постинг в Telegram из самого Postiz рвался: TG-пост вис в `QUEUE`, потом `ERROR`.
Две причины, обе в контейнере `postiz`:

1. **Не задан `TELEGRAM_TOKEN`** — нативный TG-провайдер создаёт бота как
   `new TelegramBot(process.env.TELEGRAM_TOKEN)`; без токена слать нечем.
2. **Нет egress к `api.telegram.org`** (RU-DPI; из контейнера `ETIMEDOUT`), VK при
   этом доступен напрямую.

**Фикс — env контейнера `postiz` в `docker-compose.trim.yaml`:**
```yaml
TELEGRAM_TOKEN: "<бот bit_and_pix_bot>"
HTTPS_PROXY: "http://<user>:<pass>@5.2.66.188:8888"
HTTP_PROXY:  "http://<user>:<pass>@5.2.66.188:8888"
NO_PROXY: "localhost,127.0.0.1,::1,postiz-postgres,postiz-redis,temporal,tech.bitandpix.ru,5.42.112.17,5.2.66.188,vk.com,.vk.com,userapi.com,.userapi.com,vkuser.net,.vkuser.net"
```

**Почему это работает и почему `NO_PROXY` именно такой (важный нюанс клиентов):**
- TG-провайдер шлёт через `node-telegram-bot-api` (либа `request`) — она **уважает
  `HTTPS_PROXY` из env** → TG уходит через tinyproxy. ✅
- VK-провайдер делает API-вызовы через `fetch`/undici — **env-прокси игнорирует** →
  VK API и так напрямую, прокси на него не влияет.
- **НО** VK-провайдер заливает фото на upload-сервер (`pu.vk.com`/`*.userapi.com`)
  через **Axios**, а Axios **уважает env-прокси**. Если не исключить VK-домены —
  заливка уходит с IP прокси, а upload-URL VK привязан к IP запросившего → `404`.
  Поэтому VK-домены добавлены в `NO_PROXY` (Axios для VK идёт напрямую). Итог:
  **через прокси — только Telegram, всё остальное напрямую.**
- Применение: `docker compose -f docker-compose.trim.yaml up -d postiz` (бэкапы
  `.bak.<ts>`). Проверено боем: VK `wall-239528257_6` + TG `t.me/…/6` (карусель 3 фото).

## Что НЕ сделано (открыто)

- **VK-приложение** → env Postiz **`VK_ID`/`VK_SECRET`** (НЕ `VK_CLIENT_ID` —
  issue #1398 был про это: имя переменной `VK_ID`). Postiz использует **VK ID
  OAuth** (`id.vk.com/authorize`, PKCE S256), scopes `wall`, `photos` (+др.),
  постит через `wall.post` + `photos.saveWallPhoto`.
  - **Redirect URI для VK-приложения (точно):**
    `https://tech.bitandpix.ru/integrations/social/vk`
    (формула: `${FRONTEND_URL}/integrations/social/vk`).
  - Создать на `dev.vk.com` → платформа «Сайт», базовый домен `tech.bitandpix.ru`.
    «ID приложения» → `VK_ID`, «Защищённый ключ» (client_secret) → `VK_SECRET`.
- **Тестовое VK-сообщество: `VK_GROUP_ID=239528257`** (уже в репо `.env`, общий с
  проектом чатов/Chatwoot; там же `VK_COMMUNITY_TOKEN` для него). Оператор —
  админ этого сообщества, на нём и гоняем первый постинг-тест.
- ✅ **Egress контейнера Postiz через tinyproxy для Telegram — СДЕЛАНО 15.06.2026.**
  См. секцию «Postiz → Telegram egress» выше (TELEGRAM_TOKEN + HTTPS_PROXY +
  NO_PROXY с исключением VK-доменов из-за Axios-аплоада фото).
