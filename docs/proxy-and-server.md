# Инфраструктура SMM-системы — где что и как достучаться

Карта серверов, портов, креденшелов и стандартных путей запросов.

## Что где

| Хост | IP | Назначение | SSH |
|---|---|---|---|
| **OpenClaw runtime** (RU) | `5.42.117.201` | Где живёт сам бот, агенты, рендерит HTML, общается с Telegram | `ssh root@5.42.117.201` (по ключу) |
| **Foreign proxy + LiteLLM** | `5.2.66.188` | Tinyproxy для блокированных сервисов + LiteLLM gateway + Postgres | `ssh -p 24822 root@5.2.66.188` |
| **S3 (Timeweb)** | `s3.twcstorage.ru` | Хранение медиа: HTML, PNG, JPG, PDF постов и ассетов | HTTPS API, креды в `.env` |
| **Telegram-канал** | группа SEO-claw (id `-1003738582316`) | Входная точка для оператора, форум-топики по проектам | — |

## Сервисы на проксе `5.2.66.188`

| Порт | Сервис | Креды | Что |
|---|---|---|---|
| `8888` | tinyproxy | BasicAuth `prepbro:f7VT7Jsq7ufb7K7zvmSj3ya` | HTTP/HTTPS прокси для исходящего трафика с RU-сервера |
| `4000` | LiteLLM | master `sk-prepbro-9d2d6fc99ae7a803e1269fb2e7d49d224156ed8a002c20502ada6f1739935904` | AI-gateway, OpenAI-compatible API + Postgres spend tracking |
| `24822` | SSH | ключи `~/.ssh/` пользователя | Управление прокси-сервером |

Постгрес LiteLLM — в Docker-стэке `litellm-postgres`, пароль в `/root/litellm/.env` → `POSTGRES_PASSWORD`.

ufw на проксе разрешает порт `8888` **только с IP RU-сервера** (`5.42.117.201`) и с дом-IP разработчика (`178.253.42.36`). Если деплоишь с нового хоста — открой ufw:

```bash
ssh -p 24822 root@5.2.66.188 'ufw allow from <НОВЫЙ_IP> to any port 8888 proto tcp && ufw reload'
```

## Как сделать запрос через прокси

### Из shell на RU-сервере или с домашней машины разработчика

System-wide уже настроено через `/etc/environment` на 5.42.117.201:

```bash
HTTP_PROXY=http://prepbro:f7VT7Jsq7ufb7K7zvmSj3ya@5.2.66.188:8888
HTTPS_PROXY=http://prepbro:f7VT7Jsq7ufb7K7zvmSj3ya@5.2.66.188:8888
NO_PROXY=localhost,127.0.0.1,::1,5.42.117.201,5.2.66.188
```

`curl`, `wget`, `apt`, `git`, `npm` — все читают эти переменные. Прим: `s3.twcstorage.ru` РФ-хост, прокси не нужен; добавили его в `NO_PROXY`. Аналогично для `api.telegram.org` он не блокирован — но всё равно через прокси проходит OK.

### Из Node.js скриптов

AWS SDK игнорирует HTTPS_PROXY по умолчанию — `tools/s3.mjs` ходит прямо в `s3.twcstorage.ru`.

`fetch` в Node 20+ **не** уважает HTTPS_PROXY автоматически. Если нужно — устанавливай `undici.ProxyAgent` явно. Для нашего сценария:

- LLM-вызовы → через `LITELLM_URL` (внутренний proxy-host, не нужен HTTPS_PROXY)
- Telegram API → доступен напрямую, прокси не нужен
- fal.ai → npm-пакет `@fal-ai/client` использует undici, HTTPS_PROXY уважает только если задать `HTTPS_PROXY` или `https_proxy` в env — на RU-сервере уже задано через `/etc/environment`

### Из Docker (на RU-сервере, если потребуется)

`docker.service` имеет override `/etc/systemd/system/docker.service.d/http-proxy.conf` с HTTPS_PROXY — `docker pull` ходит через тинипрокси.

## LiteLLM — как обращаться

### Из приложения (OpenAI-совместимый клиент)

```bash
curl http://5.2.66.188:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "smm/claude-haiku-4.5",
    "messages": [{"role":"user","content":"Привет"}]
  }'
```

`LITELLM_KEY` — virtual key проекта (см. `.env`), не master.

### Список доступных моделей

```bash
curl -sS http://5.2.66.188:4000/v1/models -H "Authorization: Bearer $LITELLM_KEY"
```

Доступны для SMM проекта (через virtual key):
- `smm/claude-haiku-4.5` — дефолт для большинства агентов
- `smm/claude-sonnet-4.6` — оркестратор, дизайнер, Душнила
- `smm/claude-opus-4-7` — для сложных задач
- `smm/deepseek-v3` — для bulk
- `smm/gemini-2.5-flash` — vision (анализ изображений)
- `smm/gemini-2.5-pro` — более качественный vision

### Расход

```bash
# сводка
node tools/spend.mjs

# UI (логин — master key)
open http://5.2.66.188:4000/ui
```

### Управление virtual keys (нужен master key)

```bash
ssh -p 24822 root@5.2.66.188

# создать новый key
curl -X POST http://127.0.0.1:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key_alias":"smm-experimental","models":["smm/*"],"max_budget":10,"budget_duration":"30d"}'

# увеличить бюджет
curl -X POST http://127.0.0.1:4000/key/update \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{"key":"sk-GNF_...","max_budget":100}'

# инфо
curl "http://127.0.0.1:4000/key/info?key=sk-GNF_..." \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

## Telegram API

```bash
# через прокси (с RU) или напрямую (с домашней)
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
```

Полезные методы:
- `getMe` — проверить токен
- `getChat?chat_id=<id>` — инфо о группе
- `getUpdates` — последние сообщения боту
- `getChatMember?chat_id=<id>&user_id=<bot_id>` — права бота в группе

## Логи + отладка

### OpenClaw (на 5.42.117.201)

```bash
SERVICE=$(systemctl list-units --type=service --all --no-legend | grep -i openclaw | awk '{print $1}' | head -1)
journalctl -u "$SERVICE" -f --no-pager
```

### LiteLLM (на 5.2.66.188)

```bash
ssh -p 24822 root@5.2.66.188 'docker logs litellm-proxy --tail 100 -f'
ssh -p 24822 root@5.2.66.188 'docker logs litellm-postgres --tail 50'
```

### tinyproxy

```bash
ssh -p 24822 root@5.2.66.188 'tail -50 /var/log/tinyproxy/tinyproxy.log'
```

## Когда что-то не так

| Симптом | Скорее всего | Что делать |
|---|---|---|
| Бот не отвечает в группе | OpenClaw упал, токен испорчен, или whitelist не пускает | `journalctl -u openclaw -n 50` + проверить `getMe` |
| 429 / Budget exceeded | LiteLLM virtual key исчерпан | `node tools/spend.mjs`, потом увеличить через `/key/update` |
| 401 от LiteLLM | Неверный `LITELLM_KEY` | Перевыпустить через master, обновить `.env`, restart OpenClaw |
| curl таймаут с RU-сервера на внешний сервис | tinyproxy лёг или ACL изменилась | `systemctl status tinyproxy` на проксе, `ufw status` |
| fal.ai 401 | Истёк `FAL_KEY` | Обновить в `.env` + restart OpenClaw |
| S3 SSL error | Сетевая флапа Timeweb | Retry — обычно проходит со второй попытки |
