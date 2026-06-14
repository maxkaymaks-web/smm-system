# onboard-service

Тонкий HTTP-сервис: регистрирует соцканал клиента в БД Postiz (INSERT в `Integration`),
т.к. public API Postiz создавать интеграции с готовым токеном не умеет.

## Контракт
- Auth: `Authorization: Bearer $ONBOARD_API_KEY`.
- `POST /channels` body `{type:"vk", name, vk:{groupId, token}}`
  или `{type:"telegram", name, telegram:{chatId}}` → `{integrationId, updated}`.
- `GET /channels` → `{channels:[{id,name,providerIdentifier,internalId}]}`.
- Идемпотентность: по `(organizationId, providerIdentifier, internalId)` — апдейт, не дубль.
- Токен пишется СЫРЫМ (Postiz не шифрует, см. docs/postiz-integration.md).

## Env
`ONBOARD_API_KEY`, `DATABASE_URL` (как у backend Postiz), `POSTIZ_ORG_ID`,
`TELEGRAM_TOKEN` (валидация TG + штатный TG-провайдер Postiz), `VK_SERVICE_TOKEN` (опц.).

## Деплой — см. план Task 7 (docker-compose.trim.yaml + nginx /onboard/).
