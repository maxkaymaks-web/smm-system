# patches/vk.provider.js — патч VK-провайдера Postiz

Канонная версия патча VK-провайдера Postiz для постинга в стену **сообщества**
по community-токену (Postiz из коробки умеет только личную стену через VK ID OAuth).

**Куда монтируется** (на сервере, `docker-compose.trim.yaml`):
- `/app/apps/orchestrator/dist/libraries/nestjs-libraries/src/integrations/social/vk.provider.js`
- `/app/apps/backend/dist/.../vk.provider.js`
(оба `:ro`). После замены файла — `docker restart postiz` (модуль перечитывается).

**Что делает:**
- `wall.post` с `owner_id=-groupId`, `from_group=1` (пост от лица сообщества).
- Фото грузит через **messages-upload-сервер** (`photos.getMessagesUploadServer` +
  `photos.saveMessagesPhoto`) — `photos.getWallUploadServer`/`saveWallPhoto`
  community-токену недоступны (`error_code 27`). Сохранённое фото имеет
  `owner_id=-groupId` и цепляется в `wall.post` как `photo-<groupId>_<id>`.
- `refreshToken` — no-op (community-токены бессрочные).

Подробности и история — `docs/postiz-integration.md`, инфра-монтаж — `docs/infra.md`.
