---
name: onboarding-no-ssh-tools
description: Онбординг/правка клиента и подключение VK/TG каналов без ssh — тулы + серверный onboard-service
metadata: 
  node_type: memory
  type: project
  originSessionId: ee1c70b3-0342-4297-be9e-7ed81cfcc9ce
---

С 14.06.2026 операторы заводят/правят клиентов и подключают соцканалы **без ssh**,
с любого устройства. Тулы в репо: `tools/onboard/{new-client,edit-client,register-channel}.mjs`
+ `tools/lib/notion.mjs` (снимает `*_PROXY` — tinyproxy режет Notion). Регистрацию
каналов делает серверный `tools/onboard-service/` (Docker рядом с Postiz,
`127.0.0.1:4010`, nginx `https://tech.bitandpix.ru/onboard/`, bearer `ONBOARD_API_KEY`):
`INSERT/UPDATE` в таблицу `Integration` Postiz, токен СЫРЫМ. Маппинг клиент→канал —
`projects/{id}/channels.json` (`integrationId`). Оператору на руки — только
`NOTION_TOKEN` + `ONBOARD_API_KEY`; токены соцсетей в Postiz.

Детали: `docs/onboarding-no-ssh-handoff.md` (что/зачем/как проверить),
`docs/infra.md` (секция onboard-service), `docs/client-onboarding.md` (флоу).
Связано: [[postiz-vk-telegram-integration]], [[target-architecture-3-windows]],
[[secrets-vs-constants]].
