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

## Шаг 6 — проверить агентов

Запрос оператора в чат OpenClaw (через Telegram-канал, прямой API или CLI):

```
Привет. Какой статус по проекту BeautyCulture_DariaSopkina?
```

OpenClaw должен:
1. Поднять `agents/orchestrator/SOUL.md` (modeл `smm/claude-sonnet-4.6`)
2. Прочитать `projects/BeautyCulture_DariaSopkina/context.md`, `voice.md`, `content-plan.md`
3. Вернуть сводку статусов

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
