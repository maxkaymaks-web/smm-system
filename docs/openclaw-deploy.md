# Деплой OpenClaw для SMM-системы bit&pix

Поднять OpenClaw на RU-сервере `5.42.117.201`, привязать к нему `agents/*/SOUL.md` из этого репо и пускать LLM через LiteLLM на проксе.

Все секреты — в локальном `.env` (gitignored). Шаблон — `.env.example`. Текущая прод-инсталляция: OpenClaw 2026.5.7, user-systemd сервис от root, daemon на `127.0.0.1:18789`.

---

## Архитектура

```
[оператор Telegram, группа SEO-claw, форум]
    │ @seoclawww_bot @упоминание в проектном топике
    ▼
[OpenClaw gateway 5.42.117.201:18789 (loopback, user-systemd)]
    ├─► читает agents/*/SOUL.md из /root/smm-system (workspace + repoRoot)
    ├─► LLM → LiteLLM 5.2.66.188:4000 (provider litellm-smm, smm/* модели)
    └─► fal.ai / Apify / GitHub / S3 → tinyproxy 5.2.66.188:8888 (HTTPS_PROXY из EnvironmentFile)
```

---

## Шаг 1 — клонировать репо и положить `.env`

С локальной машины:

```bash
ssh root@5.42.117.201 'apt update && apt install -y git gettext-base'
ssh root@5.42.117.201 'cd /root && git clone https://github.com/maxkaymaks-web/smm-system.git'
scp .env root@5.42.117.201:/root/smm-system/.env
ssh root@5.42.117.201 'chmod 600 /root/smm-system/.env'
```

---

## Шаг 2 — Node 22 (НЕ LTS 18!) + зависимости

OpenClaw 2026.5.7 требует `Array.prototype.toSorted`, появилось в Node 20. Ставим Node 22.

```bash
ssh root@5.42.117.201
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version  # ожидание: v22.x

# npm registry доступен с RU напрямую — прокси для npm НЕ нужен и ломает CONNECT
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
cd /root/smm-system
npm install --no-audit --no-fund         # puppeteer/sharp/@fal-ai/client/pdf-lib
npm install -g openclaw@latest --no-audit --no-fund

# sqlite-vec — нативное расширение для семантического recall памяти OpenClaw.
# Без него `[memory] chunks_vec not updated — sqlite-vec unavailable. Vector
# recall degraded.` и поиск по MEMORY.md/прошлым сессиям только полнотекстовый.
# Кладём в node_modules OpenClaw, оттуда он его и грузит через loadExtension.
cd /usr/lib/node_modules/openclaw
npm install --no-save sqlite-vec

openclaw --version
```

Если npm выкидывает `407 Proxy Authentication Required` — забыли `unset *PROXY`.

---

## Шаг 3 — Onboard OpenClaw (non-interactive)

Onboard создаёт `~/.openclaw/openclaw.json` + workspace + systemd user-юнит.
Авторизация — `custom-api-key` (LiteLLM = OpenAI-compatible endpoint).

```bash
set -a; . /root/smm-system/.env; set +a
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy

cd /root/smm-system
openclaw onboard --non-interactive --accept-risk \
  --flow manual --mode local \
  --auth-choice custom-api-key \
  --custom-api-key "$LITELLM_KEY" \
  --custom-base-url "$LITELLM_URL" \
  --custom-model-id smm/claude-sonnet-4.6 \
  --custom-compatibility openai \
  --custom-text-input \
  --install-daemon \
  --gateway-bind loopback --gateway-auth token \
  --skip-channels --skip-search --skip-skills --skip-ui --skip-bootstrap
```

Проверь:
- `~/.openclaw/openclaw.json` создан
- Сервис `openclaw-gateway.service` запущен (user-mode systemd)

```bash
export XDG_RUNTIME_DIR=/run/user/0
systemctl --user status openclaw-gateway --no-pager | head -10
```

Сохрани сгенерированный `gateway.auth.token` в локальный `.env` как `OPENCLAW_GATEWAY_TOKEN` — пригодится при патчах:

```bash
jq -r '.gateway.auth.token' /root/.openclaw/openclaw.json
```

---

## Шаг 4 — донастроить config (workspace, все smm/* модели, Telegram allowlist)

Onboard кладёт минимальный конфиг (только `smm/claude-sonnet-4.6`, workspace в `~/.openclaw/workspace`).
Дотягиваем до боевого состояния через `openclaw config patch` — атомарный валидируемый write.

```bash
cat > /tmp/oc-patch.json5 <<'EOF'
{
  agents: {
    defaults: {
      workspace: "/root/smm-system",
      repoRoot: "/root/smm-system",
      model: {
        primary: "litellm-smm/smm/claude-sonnet-4.6",
        fallbacks: ["litellm-smm/smm/claude-haiku-4.5"]
      },
      models: null
    }
  },
  models: {
    providers: {
      // удалить auto-derived провайдер от onboard
      "custom-5-2-66-188-4000": null,
      "litellm-smm": {
        baseUrl: "http://5.2.66.188:4000",
        api: "openai-completions",
        apiKey: "sk-GNF_VdxV3o5j_Tm317m4nA",
        models: [
          { id: "smm/claude-sonnet-4.6",  name: "Claude Sonnet 4.6 (LiteLLM)", api: "openai-completions", input: ["text", "image"] },
          { id: "smm/claude-haiku-4.5",   name: "Claude Haiku 4.5 (LiteLLM)",  api: "openai-completions", input: ["text", "image"] },
          { id: "smm/claude-opus-4-7",    name: "Claude Opus 4.7 (LiteLLM)",   api: "openai-completions", input: ["text", "image"] },
          { id: "smm/deepseek-v3",        name: "DeepSeek V3 (LiteLLM)",       api: "openai-completions", input: ["text"] },
          { id: "smm/gemini-2.5-flash",   name: "Gemini 2.5 Flash (LiteLLM)",  api: "openai-completions", input: ["text", "image"] },
          { id: "smm/gemini-2.5-pro",     name: "Gemini 2.5 Pro (LiteLLM)",    api: "openai-completions", input: ["text", "image"] }
        ]
      }
    }
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: "8550098048:AAH...",          // подставь из .env
      dmPolicy: "disabled",
      groupPolicy: "allowlist",
      groupAllowFrom: ["telegram:1642013697"], // user_id оператора (см. ниже)
      groups: {
        "-1003738582316": {
          requireMention: true,
          groupPolicy: "open"
        }
      }
    }
  }
}
EOF

openclaw config patch --file /tmp/oc-patch.json5 --dry-run   # проверь
openclaw config patch --file /tmp/oc-patch.json5             # применить
```

⚠️ **`groupAllowFrom` обязательно**, иначе при `groupPolicy: allowlist` все сообщения silent-drop'аются. Узнать user_id оператора — из admin'ов группы:

```bash
set -a; . /root/smm-system/.env; set +a
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatAdministrators?chat_id=${TELEGRAM_GROUP_ID}" \
  | jq '.result[] | select(.user.is_bot==false) | {id: .user.id, name: .user.first_name, username: .user.username}'
```

Записать в `.env` как `TELEGRAM_OWNER_ID`.

---

## Шаг 5 — systemd EnvironmentFile (для tools/* — fal.ai, S3, Telegram)

OpenClaw gateway сам не нуждается в `.env` (всё в openclaw.json), но агенты вызывают `node tools/tg-send.mjs`, `tools/generate-image.mjs`, `tools/s3.mjs` — им нужны `FAL_KEY`, `S3_*`, `HTTPS_PROXY`, `TELEGRAM_BOT_TOKEN`.

```bash
mkdir -p /root/.config/systemd/user/openclaw-gateway.service.d
cat > /root/.config/systemd/user/openclaw-gateway.service.d/env.conf <<EOF
[Service]
EnvironmentFile=/root/smm-system/.env
EOF
chmod 600 /root/.config/systemd/user/openclaw-gateway.service.d/env.conf

export XDG_RUNTIME_DIR=/run/user/0
systemctl --user daemon-reload
systemctl --user restart openclaw-gateway
sleep 4
systemctl --user status openclaw-gateway --no-pager | head -10
```

Проверь что Drop-In виден: `Drop-In: env.conf` в выводе status.

---

## Шаг 6 — sanity checks

```bash
# 1. Сервис активен, плагины загружены (browser, file-transfer, telegram, ...)
journalctl --user -u openclaw-gateway -n 30 --no-pager | grep -E 'plugins|telegram'

# 2. Doctor — должен быть без warnings про telegram allowlist / model / workspace
openclaw doctor 2>&1 | grep -iE 'warning|error' | head -20

# 3. Каталог моделей содержит все 6 smm/*
openclaw infer model list 2>&1 | grep litellm-smm | wc -l   # ожидание: 6

# 4. LLM ping через OpenClaw → LiteLLM → OpenRouter → Anthropic
openclaw infer model run \
  --model "litellm-smm/smm/claude-haiku-4.5" \
  --prompt "Reply with exactly the word PONG"
# ожидание: PONG

# 5. fal.ai через прокси
node /root/smm-system/tools/generate-image.mjs "test prompt" /tmp/test.jpg 1:1 0.5K

# 6. Telegram smoke (с любого устройства Pavel'а):
#    в группе SEO-claw, в любой топик: "@seoclawww_bot ping"
#    ожидание: бот отвечает (через orchestrator → litellm-smm/smm/claude-sonnet-4.6)
```

---

## Шаг 7 — Cron на чистку /tmp (опционально)

Агенты работают через `/tmp/{ProjectID}-{date}-{N}/` и должны сами убирать за собой,
но если упало — мусор копится.

```bash
echo '0 * * * * find /tmp -maxdepth 1 -type d -mtime +1 -name "[A-Z]*" -exec rm -rf {} \; 2>/dev/null' \
  | crontab -
```

---

## Расход / бюджет

```bash
# С RU-сервера
node /root/smm-system/tools/spend.mjs              # сводка по virtual key
node /root/smm-system/tools/spend.mjs --logs 7     # детально (нужен LITELLM_ADMIN_KEY)
```

Бюджет SMM virtual key: **$50 на 30 дней**. При 429 на ключе — поднять с прокс-сервера:

```bash
ssh -p 24822 root@5.2.66.188 \
  'set -a; . /root/litellm/.env; set +a;
   curl -sS -X POST http://127.0.0.1:4000/key/update \
     -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
     -H "Content-Type: application/json" \
     -d "{\"key\":\"sk-GNF_VdxV3o5j_Tm317m4nA\",\"max_budget\":100}"'
```

---

## Обновление SOUL.md / правил / контента

OpenClaw читает файлы из `/root/smm-system/` (workspace + repoRoot). Pull + рестарт:

```bash
ssh root@5.42.117.201 '
  cd /root/smm-system && git pull origin main
  export XDG_RUNTIME_DIR=/run/user/0
  systemctl --user restart openclaw-gateway   # только если изменился openclaw.json или .env
'
```

Изменения в `agents/*/SOUL.md` рестарта не требуют — агенты перечитывают при каждом запуске.

---

## Что НЕ делать

- Не вписывать `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` напрямую в `.env`. Только `LITELLM_KEY` — все LLM-вызовы через LiteLLM
- Не использовать `--auth-choice litellm-api-key` в onboard (хардкодит chat URL, не то что надо). Только `custom-api-key` + `--custom-base-url`
- Не оставлять `groupPolicy: allowlist` без `groupAllowFrom` — silent-drop всех сообщений
- Не ставить Node 18 — `toSorted` отсутствует, openclaw postinstall падает
- Не забывать `npm install sqlite-vec` в `/usr/lib/node_modules/openclaw/` — без него семантический recall сломан (полнотекстовый поиск по `MEMORY.md` всё ещё работает, но `MEMORY.md` придётся перечитывать вручную)
- `git push` с RU-сервера — нужен PAT: `printf "https://x-access-token:$GITHUB_PAT@github.com\n" > ~/.git-credentials && chmod 600 ~/.git-credentials && git config --global credential.helper store`. Без него авто-коммиты бота (например, сценарии Lis_Gym) застревают локально
