---
name: smm-servers-and-egress
description: "Два сервера bit&pix (основной seo + прокси), их SSH-порты, tinyproxy egress, RAM-затык под Postiz"
metadata: 
  node_type: memory
  type: project
  originSessionId: ea1c9c96-b653-4471-b05d-2c7a3322580a
---

Инфра bit&pix (проверено 12.06.2026, подробности в репо `docs/infra.md`):

- **Основной «seo» `5.42.112.17`** (IP сменён 23.06.2026 со старого `5.42.117.201`,
  тот «попался хуёвый»; во всём репо IP заменён) — медиа/S3 (bucket=seo), архив сессий CC.
  Ubuntu 24.04, Node v22, **Docker CE + compose стоят**. **Postiz работает**
  (`:4007`, `/opt/postiz-official/docker-compose.trim.yaml`, урезанный 5-конт.
  стек без Elasticsearch). RAM **1.9 → 8 GiB** + 2G swap (делит с Chatwoot `:3000`).
  Детали и грабли (Temporal, search-attributes Keyword-фикс, VK_ID) — в репо
  `docs/infra.md`. Креды Postiz (API-ключ/админ) — в репо `.env` как `POSTIZ_*`.
  ⚠️ **SSH на порту `22`**, НЕ 24822 (24822 закрыт). С недоверенных IP роняет
  коннект на kex (fail2ban).
- **Прокси `5.2.66.188`** — tinyproxy `:8888`, BasicAuth (пароль в `.env`
  `PROXY_URL`, не в git), CONNECT 443/563, allow-лист по IP (основной уже внутри).
  SSH на `24822`. Также крутит `litellm-proxy` :4000 (наследие OpenClaw).
  ⚠️ **При смене IP RU-сервера allow-лист держится в ДВУХ местах** на проксе:
  `/etc/tinyproxy/tinyproxy.conf` (`Allow <ip>`, reload tinyproxy) **И ufw**
  (`ufw allow from <ip> to any port 8888 proto tcp`). Если не обновить — egress
  с нового IP мёртв (timeout/`000`, не 403, т.к. ufw роняет TCP до tinyproxy),
  и Postiz не стартует (не может скачать esbuild с npm → фронт :4200 не поднимается → 502).
  Плюс на seo обновить `NO_PROXY` в `/etc/environment` (старый IP → новый).

- **Резервный доступ по голому IP** (сделано 23.06.2026, «если домены отъебнут»):
  на seo ufw выключен, порты сервисов биндятся на `0.0.0.0` → доступны по IP:
  Chatwoot `:3000`, Postiz `:4007`, survey `:4020`, onboard `:4010` (последние два
  ребиндил с `127.0.0.1`; survey — standalone `docker run`, не compose). **Caveat
  Postiz:** фронт собран с зашитым доменом (`NEXT_PUBLIC_BACKEND_URL=tech.bitandpix.ru/api`),
  по IP отдаёт страницу, но API-вызовы всё равно идут в домен → настоящий break-glass
  для Postiz = строчка в `/etc/hosts` оператора (`<ip> tech/chat/survey.bitandpix.ru`),
  тогда работает через nginx+валидный TLS в обход DNS.

Egress (уточнено 14.06.2026): **VK API (`api.vk.com`) — напрямую, стабильно**
(и с хоста, и из docker-контейнеров). **Telegram API — НЕ полагаться на прямой
путь**: RU-DPI режет часть Telegram-DC по IP (`149.154.166.110`, `91.108.4.x`
таймаутят, `149.154.167.220` — ок), DNS отдаёт IP по кругу → прямой `fetch`
флапает; из docker-контейнера TG особенно нестабилен (`ETIMEDOUT`). **Надёжный
egress к Telegram — только через аутентиф. tinyproxy `5.2.66.188:8888`**
(`getMe` через него = ok). Node `fetch`/undici env-прокси ИГНОРИРУЕТ → в коде
нужен явный `ProxyAgent` (TG-валидация через `TELEGRAM_PROXY`, VK напрямую).
**fal.ai / OpenAI / Anthropic геоблочат РФ-IP** (TLS обрывается на handshake) —
тоже только через прокси.

На сервере: **входящий** омниканальный инбокс операторов на Chatwoot —
**развёрнут и работает** на `https://chat.bitandpix.ru` (`/opt/chatwoot`,
`:3000`+nginx+HTTPS). VK+TG в обе стороны, текст и медиа. Шлюз VK/TG — сервис
chatwoot-gateway (исходник переехал в `smm-app/temp/chatwoot-gateway/` при Track 2;
детали — `docs/omnichannel-inbox.md`). Публикация — вручную (Postiz отклонён).
