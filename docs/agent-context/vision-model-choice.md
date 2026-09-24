---
name: vision-model-choice
description: Vision-модель для бота OpenClaw — Gemini 2.5 Flash (primary) + Codex Sonnet 4.6 (fallback). Прописана в agents.defaults.imageModel.
metadata:
  node_type: memory
  type: project
---

В `/root/.openclaw/openclaw.json` стоит (после 2026-05-14):
```json
"imageModel": {
  "primary": "litellm-smm/smm/gemini-2.5-flash",
  "fallbacks": ["litellm-smm/smm/claude-sonnet-4.6"]
}
```

(Был Haiku 4.5 как fallback, заменён на Sonnet 4.6 в рамках решения «Haiku в системе не используем» — см. [no-haiku-everywhere-sonnet](no-haiku-everywhere-sonnet.md).)

Обе модели уже подключены в LiteLLM-роутере на `5.255.105.123:4000` под виртуальным ключом `smm/*` (трекинг бюджета SMM-проекта отдельно от остального).

**Why:** инцидент 2026-05-12 — бот падал на `No image model is configured` при анализе фоток с photoprism для проекта Sparta. Из всех vision-моделей в роутере (Sonnet 4.6, Haiku 4.5, Opus 4.7, Gemini 2.5 Flash, Gemini 2.5 Pro) выбрана **Gemini 2.5 Flash** по цене/качеству для задачи "описать фотку, посчитать людей, оценить для соцсетей":
- $0.30/$2.50 за 1M токенов — в 3 раза дешевле Haiku ($1/$5), в 10 раз дешевле Sonnet.
- Multimodal-first архитектура — на бытовых сценах vision-recall и описание эмоций сильнее Codex.
- Anthropic Haiku — fallback на случай rate-limit/отказа Gemini (политики Anthropic мягче на лицах).
- Llama 4 Scout / Qwen-VL дешевле, но не в нашем роутере + open-source vision стабильно слабее на нюансах эмоций → не стоят экономии 5–10 центов на проекте.

**How to apply:** если бот опять зальёт `[tools] image failed: No image model is configured` — проверить, что в `openclaw.json` есть ключ `agents.defaults.imageModel`. Если нет — добавить из этого блока. Если есть, но LiteLLM ругается — проверить `smm/gemini-2.5-flash` в `/root/litellm/config.yaml` на проксе (`ssh -p 24822 root@5.255.105.123`). Подробности доступа — [openclaw-server-access](openclaw-server-access.md).

Если задача меняется (нужно не описание сцены, а OCR / точная geometry / медицинская vision) — пересматривать выбор; для текущего use-case Flash достаточен.
