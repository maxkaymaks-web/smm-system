---
name: secrets-vs-constants
description: "Где хранить конфиг — секреты в .env, не-секретные константы (ID баз и т.п.) открыто в репо"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: db7dfd83-13b4-4e31-b646-b9097a646c92
---

В `.env` (gitignored) — **только секреты**: токены, ключи, пароли (`NOTION_TOKEN`, `FAL`, `APIFY`, `GOOGLE_APPLICATION_CREDENTIALS` и т.п.).

Не-секретные константы (Notion DB ID, parent page ID, endpoint'ы, prod-настройки) — **хранить открыто в репозитории**, не в `.env`. Сейчас Notion-ID лежат в `config/notion.json`.

**Почему:** оператор поправил 13.06.2026 — «ID баз это не секреты, а константы, храни в открытую». ID базы Notion не даёт доступа без токена, поэтому скрывать его незачем, а открытый конфиг проще шарить и версионировать.

**Как применять:** перед записью в `.env` спросить «это даёт доступ само по себе?». Если нет — это константа, в открытый конфиг. См. [[target-architecture-3-windows]].
