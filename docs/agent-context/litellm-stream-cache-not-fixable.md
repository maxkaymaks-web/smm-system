---
name: litellm-stream-cache-not-fixable
description: "LiteLLM теряет cache_creation/cache_read tokens при streaming во всех async logging (SpendLogs тоже). Maintainer'ы закрыли как not planned. Менять API/провайдер бесполезно."
metadata:
  node_type: memory
  type: reference
---

**Проблема:** при `stream:true` через LiteLLM Proxy в БД `LiteLLM_SpendLogs` всегда `cache_hit=False`, `prompt_tokens_details=null`, spend посчитан **по полным ставкам** — без учёта реальной cache-скидки. Anthropic в финальном usage-chunk эти поля присылает, но LiteLLM их не пробрасывает в async logging.

**Источники (15.05.2026):**
- [Issue #7790](https://github.com/BerriAI/litellm/issues/7790) — `Anthropic usage prompt cache details missing from logging callbacks when streaming` → **closed as not planned**
- [Issue #11789](https://github.com/BerriAI/litellm/issues/11789) — `Anthropic cost calculations are incorrect with streaming and prompt caching` → closed
- [Issue #13207](https://github.com/BerriAI/litellm/issues/13207) — связанная проблема с total tokens

**Что НЕ помогает (проверено 15.05.2026):**
- Переключение `model_name` на `anthropic/...` с `api_base=OpenRouter` — баг проявляется на обоих API (`chat/completions` и `/v1/messages`).
- Передача `cache_control` явно в system block — игнорируется для streaming usage.
- Probe direct OpenRouter `/v1/messages` (без LiteLLM) **показывает корректно** `cache_creation_input_tokens=1216` → `cache_read_input_tokens=1216`, cost $0.0046 → $0.000462 (10×). Значит upstream работает, LiteLLM режет.

**Реальное измерение расхода:** только через OpenRouter dashboard / Activity API (для последнего нужен management key, обычный key даёт 403). В одной сессии 15.05.2026: LiteLLM показал $0.43, реально с OpenRouter $0.316 (~26% завышение).

**Решение в нашем стеке:**
- Daily spend-отчёт (`smm-spend-daily.timer` + crontab) **отключён** 15.05.2026 — показывал завышенную цифру.
- `tools/spend.mjs` оставлен для non-stream probe (там данные корректны).
- Если когда-нибудь надо точные цифры по OpenClaw — сделать custom parser SSE-чанков LiteLLM proxy_logs, или подключить OpenRouter management API.

Связано: [litellm-prompt-cache-config](litellm-prompt-cache-config.md), [openclaw-payload-quirks](openclaw-payload-quirks.md).
