---
name: no-direct-internet-from-ru-server
description: "RU-сервер 5.42.117.201 ХОДИТ во внешние сервисы (fal.ai, OpenAI, Anthropic, OpenRouter) ТОЛЬКО через 3proxy 5.255.105.123:8888. Прямые запросы — нестабильны (TLS-флэпы, RU-блок)."
metadata:
  node_type: memory
  type: project
---

OpenClaw runtime крутится на RU-IP `5.42.117.201`. **fal.ai, OpenAI, Anthropic, api.telegram.org из РФ напрямую не работают** — заблокированы / TLS обрывается на handshake (это не флэп, это стабильный блок РКН). **Все исходящие LLM/AI/image-gen/Telegram вызовы должны идти через 3proxy на egress-боксе `5.255.105.123:8888`.** Если запрос упал с `fetch failed | Client network socket disconnected before secure TLS connection was established` — клиент ушёл напрямую, не через прокси.

**Telegram тоже блокируется** (Pavel подтвердил 2026-05-12). Из РФ `api.telegram.org` нестабилен (polling stalls, sendChatAction fails). **НЕ класть `api.telegram.org` в `NO_PROXY`** — он ОБЯЗАН идти через прокси, иначе бот будет терять getUpdates и отваливаться на sendMessage. (Раньше я ошибочно положил его в NO_PROXY — откатил.)

В env у systemd-юнита `openclaw-gateway.service` уже стоят `HTTPS_PROXY/HTTP_PROXY/NO_PROXY` (включая russian-host исключения). Но **не всё Node автоматически уважает env-прокси** — нативный `fetch`/undici игнорит `HTTPS_PROXY` по умолчанию. Поэтому если в логах появляется:

```
[image-generation] candidate failed: fal/fal-ai/flux/dev: fetch failed | Client network socket disconnected before secure TLS connection was established
```

— это **не fal.ai сломан, а запрос пошёл напрямую с RU-IP** мимо прокси. Проверка: `curl -x http://prepbro:...@5.255.105.123:8888 https://fal.ai/` отвечает 200, прямой `fetch` из node иногда 200/404, иногда срывает TLS.

**Why:** инцидент 2026-05-12 — `image_generate` (fal-ai/flux/dev) дважды упал на TLS из-за RU-блока. Pavel подтвердил: «этот сервис просто не доступен из РФ». Curl через прокси к fal.ai отвечает 200 — значит обход блока через тинипрокси работает, нужно только убедиться что Node-клиент туда смотрит.

**How to apply:**
1. Для OpenClaw это уже решено через preload-скрипт `/root/openclaw-proxy-preload.cjs`, подключённый через systemd drop-in `NODE_OPTIONS=--require=...`. Он ставит `EnvHttpProxyAgent` как global undici dispatcher — все `fetch()` уходят через прокси. Проверка работы: `journalctl --user -u openclaw-gateway | grep proxy-preload` — должна быть строка `global undici dispatcher = EnvHttpProxyAgent`.
2. Когда видишь `fetch failed | TLS ... handshake` в логах OpenClaw — preload не сработал. Проверить, что есть drop-in `proxy-preload.conf` и скрипт читается.
3. Любые **новые** инструменты/скрипты, которые с сервера дёргают внешние HTTPS — обязательно через прокси:
   - Node 20+ `fetch` → или preload `EnvHttpProxyAgent` (как у OpenClaw), или явный `undici.ProxyAgent`.
   - `@fal-ai/client` → читает `HTTPS_PROXY` из env, но через undici → нужен dispatcher.
   - AWS SDK (s3) → игнорит `HTTPS_PROXY` всегда; `s3.twcstorage.ru` РФ-хост, прокси не нужен.
   - `axios` → читает env только если `proxy: false` НЕ задан.
4. Проверить env реального процесса: `cat /proc/$(systemctl --user show -p MainPID --value openclaw-gateway)/environ | tr '\0' '\n' | grep -i proxy`.
5. `NO_PROXY` для OpenClaw runtime: `localhost,127.0.0.1,::1,5.42.117.201,5.255.105.123,s3.twcstorage.ru` — задано и в `/etc/environment`, и в `.env`. Telegram (api.telegram.org) **НЕ** в этом списке — он заблокирован из РФ и идёт через прокси наравне с fal.ai/OpenAI. `s3.twcstorage.ru` — РФ-хост, прокси не нужен.

Подробности кредов и портов — `docs/proxy-and-server.md` в репо. Связано: [openclaw-server-access](openclaw-server-access.md).
