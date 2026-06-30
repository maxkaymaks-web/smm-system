---
name: postiz-vk-telegram-integration
description: "Как подключены VK (патч+community-токен) и Telegram в Postiz; ключевые id/факты, детали в docs/postiz-integration.md"
metadata: 
  node_type: memory
  type: project
  originSessionId: ea1c9c96-b653-4471-b05d-2c7a3322580a
---

Постинг в соцсети идёт через **Postiz** (https://tech.bitandpix.ru), Claude кладёт
посты **HTTP-запросом к `/public/v1/posts`** (ключ `POSTIZ_API_KEY` в `.env`), без SSH.
Полный хэндофф и «что дальше» — в репо **`docs/postiz-integration.md`**.

Ключевое:
- **VK**: из коробки Postiz не умеет постить в сообщество (только личная стена через
  OAuth+модерация). Решение = **community-токен + НАШ патч провайдера**
  (`/opt/postiz-official/patches/vk.provider.js`, owner_id=-group, from_group=1).
  Онбординг клиента: `vk.com/club<id>?act=tokens` → ключ с правами Стена/Фото/Управление.
  Community-токен умеет `wall.post` (текст). **Фото на стену — только через
  messages-upload** (`getMessagesUploadServer`+`saveMessagesPhoto`, цепляем
  `photo-<gid>_<id>`); `getWallUploadServer`/`saveWallPhoto` для group-auth = error 27.
  НЕ умеет `wall.get/delete/edit` (тоже 27) → опубликованное не правим/не удаляем.
  Первый успешный фото-пост (карусель): `wall-239528257_3` (14.06, после фикса патча).
- **🔑 Postiz хранит Integration.token в ОТКРЫТОМ виде** (не шифровать! иначе invalid_token).
- Регистрация канала = INSERT в таблицу `Integration` (RAW токен), теперь через
  `tools/onboard-service` (не руками). Org id `637b7803-9bd5-472e-ad37-cf2ce87ac773`.
  VK-канал bit&pix: internalId=239528257 (=VK_GROUP_ID); конкретный integrationId
  волатилен (пере-регистрируется, был `c4665509`, стал `dfb5e5d1`) — смотреть в
  `projects/{id}/channels.json` или `GET /onboard/channels`.
- **Telegram**: родной провайдер Postiz, один бот из env `TELEGRAM_TOKEN` (бот
  `bit_and_pix_bot`, токен = `TELEGRAM_BOT_TOKEN`). Регистрация: INSERT integration
  telegram, token=String(chat_id). Бот должен быть админом канала.
- **Instagram — не в MVP** (Meta App Review + RU-юр.риски).
- User-токен VK (edit/delete) — тупик: scope `wall` за модерацией, gray app-id заблочены.

Грабли окружения (детали — [[smm-servers-and-egress]]): **Telegram API к серверу
только через аутентиф. прокси** (DPI режет часть DC; из docker-контейнера прямой
путь = ETIMEDOUT) — Node fetch env-прокси игнорит, нужен ProxyAgent. VK API — и с
локали, и из контейнера напрямую. Скобки в grep ломают ssh-bash → скрипты через
stdin. См. также docs/infra.md.
