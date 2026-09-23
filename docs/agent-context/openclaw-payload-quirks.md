---
name: openclaw-payload-quirks
description: "Особенности payload-а OpenClaw в openai-completions API — дубль истории, structure messages. Влияет на cache_control_injection_points и анализ."
metadata:
  node_type: memory
  type: reference
---

Когда OpenClaw отправляет запрос к LiteLLM в режиме `api: openai-completions`, payload имеет необычную структуру:

**1. Дубль истории.** `messages[]` содержит ту же history **дважды подряд**: `[system, user, user, ..., system, user, user, ...]`. Размер первого `system` 13-14 KB (~3300 токенов после моего урезания systemPrompt'а), второй идентичен ему по байтам. Структура подтверждена через `LITELLM_LOG=DEBUG` в `litellm-proxy` 14.05.2026.

**2. systemPrompt стабилен в рамках сессии.** Я сравнивал hash msg[0] между 4 последовательными запросами одной сессии — все идентичны. То есть префикс кэшируется штатно.

**3. systemPrompt OpenClaw 2026.5.7 содержит секции:**
| секция | размер (после моего урезания) | можно отрезать? |
|---|---:|---|
| Tooling | ~1800 | через `tools.profile` (но `messaging` режет всё кроме чата — ломает оркестратора) |
| Tool Call Style | ~1500 | встроено, не отрезается через config |
| Execution Bias | ~650 | встроено |
| Safety | ~550 | встроено |
| OpenClaw CLI Quick Reference | ~840 | встроено, **не отрезается через config** |
| Skills (mandatory) | ~4800 | **`agents.defaults.skills: []`** убирает блок |
| Documentation | ~700 | встроено, не отрезается |
| Assistant Output Directives | ~1360 | встроено |
| Reactions | ~300 | **`messages.ackReactionScope: "off"`** убирает |
| MISSING (SOUL/USER/HEARTBEAT/IDENTITY.md) | ~300 | **`skipOptionalBootstrapFiles`** (enum только эти 4) |

**4. `streamStrategy: "session-custom"`** — OpenClaw всегда стримит. Это значит usage в response не содержит `prompt_tokens_details.cached_tokens` (см. [litellm-prompt-cache-config](litellm-prompt-cache-config.md)).

**5. messagesSnapshot в трейсе.** В `/root/.openclaw/agents/main/sessions/*.trajectory.jsonl` событие `model.completed.data.messagesSnapshot` хранит фактический messages payload (но НЕ tools[]) — удобно для отладки.

**Источник:** инспекция через `LITELLM_LOG=DEBUG` 14.05.2026 + чтение `/usr/lib/node_modules/openclaw/dist/openai-transport-stream-*.js:984` (он формирует messages[0]).
