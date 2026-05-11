# Деплой OpenClaw для SMM-системы bit&pix

Инструкция, как поднять OpenClaw на RU-сервере `5.42.117.201`, привязать к нему `agents/*/SOUL.md` из этого репо и пускать весь трафик LLM через LiteLLM.

Все секреты — в локальном `.env` (gitignored). Шаблон — `.env.example`.

---

## Архитектура

```
[оператор]
   │
   ▼
[OpenClaw на 5.42.117.201]
   ├─► агенты читают agents/*/SOUL.md (из git checkout)
   ├─► LLM вызовы → LiteLLM 5.2.66.188:4000 (smm/* модели, virtual key)
   └─► fal.ai, GitHub, Apify, VK → tinyproxy 5.2.66.188:8888 (HTTPS_PROXY)
```

Прокси-сервер `5.2.66.188` уже настроен (tinyproxy + LiteLLM + Postgres). RU-сервер уже имеет system-wide `HTTPS_PROXY` (см. `/etc/environment`).

---

## Шаг 1 — клонировать репо и положить `.env`

С локальной машины:

```bash
scp .env root@5.42.117.201:/root/smm-system.env  # пока во временное место
ssh root@5.42.117.201
```

На сервере:

```bash
# Установить git (через прокси, который уже настроен)
apt update && apt install -y git

# GitHub clone — через HTTPS, прокси прозрачно
cd /root
git clone https://github.com/maxkaymaks-web/smm-system.git
cd smm-system
mv /root/smm-system.env .env
chmod 600 .env
```

---

## Шаг 2 — установить Node.js + OpenClaw

```bash
# Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# npm уже видит HTTPS_PROXY из /etc/environment, но продублируем явно
npm config set proxy "$HTTPS_PROXY"
npm config set https-proxy "$HTTPS_PROXY"

# Зависимости проекта (puppeteer, sharp, @fal-ai/client)
cd /root/smm-system
npm install

# OpenClaw
npm install -g openclaw@latest
openclaw --version
```

---

## Шаг 3 — onboard OpenClaw

```bash
cd /root/smm-system
source .env  # подгружаем переменные в shell

openclaw onboard --install-daemon
```

В визарде:

| Поле | Значение |
|---|---|
| Provider | OpenAI-compatible (LiteLLM) |
| Base URL | `$LITELLM_URL` (`http://5.2.66.188:4000`) |
| API Key | `$LITELLM_KEY` (`sk-GNF_…`) |
| Default model | `smm/claude-sonnet-4.6` |
| Home directory | `/root/smm-system` |
| Agents directory | `agents/` |

---

## Шаг 4 — прокинуть env в systemd-сервис OpenClaw

`openclaw onboard --install-daemon` создаёт systemd-юнит. Он не наследует `/etc/environment` для пользовательских ENV — кладём через override:

```bash
SERVICE=$(systemctl list-units --type=service --all --no-legend | grep -i openclaw | awk '{print $1}' | head -1)
echo "Сервис: $SERVICE"

mkdir -p "/etc/systemd/system/${SERVICE}.d"
cat > "/etc/systemd/system/${SERVICE}.d/env.conf" <<EOF
[Service]
EnvironmentFile=/root/smm-system/.env
EOF

systemctl daemon-reload
systemctl restart "$SERVICE"
systemctl status "$SERVICE" --no-pager | head -15
```

---

## Шаг 5 — sanity checks

```bash
# 1. OpenClaw daemon живой
curl -sS http://127.0.0.1:18789/ | head -5

# 2. Egress через прокси
curl -sS https://api.ipify.org && echo
# ожидание: 5.2.66.188

# 3. LiteLLM пинг (через master)
curl -sS http://5.2.66.188:4000/health/readiness | python3 -m json.tool | head -10

# 4. Запрос к smm/claude-haiku-4.5 через SMM virtual key
source /root/smm-system/.env
curl -sS http://5.2.66.188:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"smm/claude-haiku-4.5","messages":[{"role":"user","content":"ping"}],"max_tokens":10}'

# 5. fal.ai через tinyproxy
node /root/smm-system/tools/generate-image.mjs "test prompt" /tmp/test.jpg 1:1 0.5K

# 6. Логи OpenClaw
journalctl -u "$SERVICE" -n 50 --no-pager
```

---

## Шаг 6 — Telegram-канал с whitelist группы

Цель: бот отвечает **только** в одной группе, в DM никому, на @mention.

### 6.1 Подготовка бота

В @BotFather:
- `/newbot` → имя → username → запиши токен в `.env` → `TELEGRAM_BOT_TOKEN`
- `/mybots` → выбрать → **Bot Settings → Group Privacy → Turn off**

После: добавь бота в нужную группу (для форум-группы дай ему права на чтение всех топиков).

### 6.2 Получить chat_id

С локальной машины или с RU-сервера (важно — на машине с уже доступным `.env`):

```bash
# Отправь любое сообщение в группу, потом:
node tools/get-tg-chat-id.mjs
```

Скрипт выведет таблицу `id | type | title`. Для группы id будет отрицательный
(у супергруппы — начинается с `-100`). Подставь в `.env` → `TELEGRAM_GROUP_ID`.

Альтернатива через прямой Bot API:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=-1001234567890"
```

Если возвращает `"ok":true` и `"title":"..."` — id верный.

### 6.3 openclaw.json

В репо лежит шаблон `openclaw.json.example` со ссылками `${VAR}`. На сервере:

```bash
mkdir -p /root/.openclaw /var/log/openclaw
envsubst < /root/smm-system/openclaw.json.example > /root/.openclaw/openclaw.json
chmod 600 /root/.openclaw/openclaw.json
cat /root/.openclaw/openclaw.json   # проверь что плейсхолдеры подставились
```

(`envsubst` берёт значения из shell-env; перед запуском — `set -a; source /root/smm-system/.env; set +a`.)

Ключевые поля в конфиге:
- `channels.telegram.dmPolicy: "disabled"` — личка отключена для всех
- `channels.telegram.groupPolicy: "allowlist"` — только из whitelist
- `channels.telegram.groups["-100…"].requireMention: true` — отвечает на `@seoclawww_bot вопрос`

Хочешь включить личку для себя — поменяй `dmPolicy` на `"allowlist"` и добавь `allowFrom: ["${TELEGRAM_OWNER_ID}"]` (узнать свой user_id — `node tools/get-tg-chat-id.mjs` после `/start` боту в личке).

### 6.4 Перезапуск + проверка

```bash
SERVICE=$(systemctl list-units --type=service --all --no-legend | grep -i openclaw | awk '{print $1}' | head -1)
systemctl restart "$SERVICE"
journalctl -u "$SERVICE" -n 30 --no-pager | grep -i telegram
```

В группе пиши `@seoclawww_bot какой статус по BeautyCulture?` — бот должен ответить.

OpenClaw поднимет `agents/orchestrator/SOUL.md` (модель `smm/claude-sonnet-4.6`), прочитает `projects/BeautyCulture_DariaSopkina/{context,voice,content-plan}.md`, вернёт сводку.

---

## Расход / бюджет

```bash
node tools/spend.mjs              # сводка по virtual key
node tools/spend.mjs --logs 7     # детально по моделям за 7 дней (нужен LITELLM_ADMIN_KEY)
```

Бюджет SMM virtual key: **$50 на 30 дней**, сбрасывается автоматически.

При исчерпании — LiteLLM начинает возвращать 429 на запросы с этого key. Увеличить можно с прокси:

```bash
ssh -p 24822 root@5.2.66.188 \
  'curl -sS -X POST http://127.0.0.1:4000/key/update \
     -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
     -H "Content-Type: application/json" \
     -d "{\"key\":\"sk-GNF_VdxV3o5j_Tm317m4nA\",\"max_budget\":100}"'
```

---

## Обновление SOUL.md / правил / контента

OpenClaw читает файлы из git checkout `/root/smm-system/`. Обновление:

```bash
ssh root@5.42.117.201
cd /root/smm-system
git pull origin main
# Изменения в SOUL.md не требуют рестарта — агенты перечитывают при следующем запуске
# Изменения в .env — нужен systemctl restart $SERVICE
```

---

## Что НЕ делать

- Не вписывать `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` напрямую в `.env` — только `LITELLM_KEY`. Все вызовы LLM идут через LiteLLM
- Не использовать `~/.claude/skills/` — это атрибут Claude Code, OpenClaw читает `agents/*/SOUL.md` и `skills/` (как обычные файлы) напрямую
- Не делать `git push` с RU-сервера без необходимости — основной кодинг ведётся локально
