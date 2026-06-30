---
name: vk-community-token-no-wall-photos
description: "VK community-токен НЕ может прикреплять фото к стене сообщества — hard-лимит API, для фото нужен user-токен админа"
metadata: 
  node_type: memory
  type: project
  originSessionId: a4ec8fbc-fe78-47fd-82ab-d9be90bfe5be
---

**VK community-токен (`vk1.a...`, создаётся в «Работа с API» сообщества) фундаментально
НЕ может постить фото на стену сообщества.** Только текст. Выяснено боем 15.06.2026.

Почему:
- `photos.getWallUploadServer` (штатная загрузка фото на стену) community-токену закрыт —
  `error_code 27` («method is unavailable with group auth»).
- Обход через `photos.getMessagesUploadServer` + `saveMessagesPhoto` грузит фото, но в
  приватный альбом `album_id -64` (messages); в ответе есть `access_key`. При `wall.post`
  VK **молча дропает** такое фото — пост уходит без вложений, БЕЗ ошибки. Проверено
  `photo-<gid>_<id>` и `photo-<gid>_<id>_<access_key>` (посты wall_11, wall_12) — оба
  без картинки.
- Читать стену/фото для верификации тоже нельзя: `wall.getById`/`photos.getById` → err 27,
  service-токен → err 1051, публичный HTML без авторизации пустой. Проверяет только
  залогиненный человек глазами.

**Why:** Раньше в доках стояло «фото на стену работает (wall_3)» — это была ошибка,
картинку визуально не проверяли. Патч `patches/vk.provider.js` (messages-upload + retry
на 504) фото НЕ доставляет. 504 от `pu.vk.com` — отдельная реальная проблема (CDN
ротируется), retry её лечит, но к фото отношения не имеет.

Подтверждено внешне 15.06.2026 (ресёрч-агент, HIGH confidence, 6 источников: Habr QnA
1407264/1398200/1396766 «community-токен постит текст но без медиа», Postiz issue #1408,
vk_api lib `photo_wall`, VKCOM error-schema). Важный нюанс: `saveWallPhoto` кладёт фото в
скрытый системный **wall-альбом**, а `-64` — это **messages**-альбом, поэтому
messages-обход к стене не цепляется в принципе (не тот альбом).

**How to apply:** Для фото на стену сообщества нужен **USER-токен админа группы**:
- своё VK **Standalone**-приложение (не серое app-id);
- OAuth **2.1 + PKCE** (implicit flow устарел); токен ~60 мин + refresh ~180 дней —
  **нужен рефреш-флоу** (community-токен был бессрочным — это операционная цена перехода);
- scope **`wall`+`photos`** (оба! только `wall` — фото-методы падают) + `groups`;
- флоу: `photos.getWallUploadServer?group_id=…` → upload → `photos.saveWallPhoto` →
  `wall.post owner_id=-gid&from_group=1&attachments=photo…` (постит ОТ имени сообщества);
- ⚠️ РИСК ПОДТВЕРДИЛСЯ (16.06.2026, эмпирически): VK ID гейтит `wall`+`photos`+`groups`
  ручным одобрением. Создано приложение VK ID (Web, client_id `54639228`), профиль бизнеса
  подтверждён, OAuth 2.1+PKCE c `scope=wall photos groups` прошёл — но токен вернулся со
  `scope=vkid.personal_info` (VK молча срезал права). Вызовы: `users.get` ✅,
  `photos.getWallUploadServer`→«cannot be called with current scopes», `wall.post`→
  «unavailable with current profile type». Бизнес-верификация САМА ПО СЕБЕ не открывает —
  это «расширенные доступы в исключительных случаях», нужна **заявка на
  devsupport@corp.vk.com** + ручное одобрение VK. Кода-обхода нет. Тул: `tools/vk/oauth-photo-test.mjs`.
- ⚠️ Уточнение про `vk2.a.*`: access_token нового OAuth 2.1 (`id.vk.com/oauth2/auth`) ИМЕЕТ
  вид `vk2.a.*` и РАБОТАЕТ для `api.vk.com/method/*` (в пределах выданного scope) — проверено
  users.get. «auth-only» относилось к id_token/silent-auth, не к access_token. Не путать с
  community-токеном `vk1.a.*`.

Community-токен оставляем для текста + Chatwoot (VK-диалоги).

**Решение по архитектуре (16.06.2026): Model A — сервисный аккаунт агентства.** Один
рабочий VK-аккаунт + Standalone-app, его добавляют редактором в каждую клиентскую группу,
один user-токен постит фото во все группы (`getWallUploadServer(group_id=ИХ)`). Отклонён
Model B (токен на каждого клиента). Минус Model A — SPOF на аккаунте (беречь: 2FA, симка).
Открытые риски снять первыми: (1) гейтит ли VK scope `wall`+`photos` модерацией, (2)
хватает ли роли «редактор» vs «админ». Полный план реализации (фазы 0–3) —
`docs/vk-user-token-photos.md`.

Связано: [[postiz-vk-telegram-integration]], [[smm-servers-and-egress]]. Детали/проверки —
`docs/postiz-integration.md` секция «VK community-токен».
