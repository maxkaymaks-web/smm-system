# VK: фото на стену через user-токен (своё приложение) — спека/хэндофф

> Статус: **РЕШЕНО что делаем, реализация не начата** (16.06.2026).
> Контекст-память: [[vk-community-token-no-wall-photos]]. Текущее состояние VK —
> `docs/postiz-integration.md` секция «VK community-токен». Патч провайдера —
> `patches/vk.provider.js`.

## Проблема (подтверждена боем + внешне, HIGH confidence)

**Community-токен сообщества НЕ может постить фото на стену.** Только текст.
- `photos.getWallUploadServer` под group-auth → `error_code 27`.
- Обход через `getMessagesUploadServer`+`saveMessagesPhoto` грузит фото в приватный
  альбом `-64` (messages); `wall.post` такое фото **молча дропает** (пост без вложений,
  без ошибки). Проверено `photo-<gid>_<id>` и `..._<access_key>` (посты wall_11/wall_12).
- `saveWallPhoto` кладёт фото в **скрытый системный wall-альбом** (не `-64`) — поэтому
  messages-обход и не работал.
- Источники: Habr QnA 1407264/1398200/1396766 («community-токен постит текст но без
  медиа»), Postiz issue #1408 (wall.post возвращает success даже когда дропнул вложение),
  vk_api lib `photo_wall`, VKCOM error-schema.

## Решение: user-токен админа группы

Для фото нужен **user access token** аккаунта-админа/редактора группы:
- Своё VK **Standalone**-приложение (НЕ серое app-id — их VK банит). НЕ путать с VK ID
  токенами `vk2.a.*` — те auth-only, для VK API методов не годятся.
- OAuth **2.1 + PKCE** (implicit flow устарел). Токен живёт ~1 час + refresh ~6 мес,
  refresh **ротируется** (каждый рефреш выдаёт новый refresh-токен) → нужно
  **персистентное хранилище токена с обновлением**.
- Scope: **`wall`+`photos`** (оба обязательны; только `wall` → фото-методы падают) +
  `groups`.
- Флоу постинга фото: `photos.getWallUploadServer?group_id=<gid>` → POST картинки на
  `upload_url` → `photos.saveWallPhoto(group_id, server, photo, hash)` →
  `wall.post(owner_id=-<gid>, from_group=1, attachments=photo<owner>_<id>)`.
  `from_group=1` под user-токеном админа постит ОТ имени сообщества — подтверждено.

## РЕШЕНИЕ ПО АРХИТЕКТУРЕ: Model A — сервисный аккаунт агентства

Выбрано 16.06.2026 (оператор).

- **Один рабочий VK-аккаунт агентства** + Standalone-app на него.
- Аккаунт **один раз** проходит OAuth → **один user-токен** (+ refresh-флоу) на всех.
- Онбординг клиента: клиент добавляет наш аккаунт **редактором** (или админом) своей
  группы — 2 клика, без OAuth для клиента.
- Постинг фото во все такие группы одним токеном: `getWallUploadServer(group_id=ИХ)`.
- **Минус — SPOF:** бан/угон аккаунта = встаёт всё. Беречь: 2FA, отдельная симка,
  не светить.
- Отклонён Model B (токен на каждого клиента): N токенов/refresh, клиент проходит OAuth
  и может отозвать — тяжелее в эксплуатации.

## Открытые риски — снять ПЕРВЫМИ (эмпирически, до кодинга)

1. **Модерация scope — РИСК ПОДТВЕРДИЛСЯ ЭМПИРИЧЕСКИ (16.06.2026, HARD).**
   VK ID гейтит `wall`+`photos`+`groups` ручным одобрением. Проверено боем:
   - Создано приложение VK ID (Web, client_id `54639228`), профиль бизнеса в кабинете
     показан как **подтверждённый**.
   - OAuth 2.1+PKCE с `scope=wall photos groups` прошёл БЕЗ ошибки, но токен вернулся
     со `scope=vkid.personal_info` — VK **молча срезал** все три права.
   - Прямые вызовы под этим токеном: `users.get` ✅; `photos.getWallUploadServer` →
     *«It cannot be called with current scopes»*; `wall.post` → *«method is unavailable
     with current profile type»*.
   - Вывод: бизнес-верификация сама по себе НЕ открывает `wall`/`photos`/`groups`. Это
     «расширенные доступы в исключительных случаях» — нужна **заявка на
     devsupport@corp.vk.com** и ручное одобрение VK. Кода-обхода нет.
   - Источник (офиц.): id.vk.com/.../connection/create-application → «Настройка доступов»;
     dev.vk.com/ru/api/privacy. Инструмент теста: `tools/vk/oauth-photo-test.mjs`.
   - **СЛЕДУЮЩИЙ ШАГ — не код, а письмо в VK devsupport** (см. ниже).
2. **Роль «редактор» vs «админ».** Хватает ли роли «редактор» для
   getWallUploadServer/wall.post, или нужен полный «админ»? «Редактор» — мягче просьба к
   клиенту. → проверять ПОСЛЕ того как VK выдаст scope (сейчас бессмысленно).

## Что уже сделано (16.06.2026)
- VK ID приложение создано: client_id `54639228`, платформа Web, redirect `http://localhost`
  (для разового локального захвата токена). Сервисный аккаунт: «Пикс Агент» (vk id 1119387205).
- Рабочий OAuth-флоу: `tools/vk/oauth-photo-test.mjs` (authorize / exchange / post-photo),
  PKCE корректный, access+refresh получаются. Готов заработать сразу как VK даст scope.
- БЛОКЕР: VK не выдаёт `wall`/`photos`/`groups` (см. риск 1). Нужна заявка в devsupport.

## План реализации (для агента-исполнителя)

**Фаза 0 — эмпирический тест (на группе bit&pix `239528257`, мы там админы):**
- Создать Standalone VK-app. OAuth 2.1+PKCE, scope `wall photos groups`, под аккаунтом-
  админом bit&pix. Получить user-токен.
- Скриптом проверить: `getWallUploadServer(group_id=239528257)` → upload slide_01.png +
  slide_02.png → `saveWallPhoto` → `wall.post(from_group=1, attachments=...)`.
- Глазами (залогиненный человек) подтвердить, что **карусель появилась на стене**.
- Зафиксировать: была ли модерация, хватило ли роли «редактор».
- Медиа для теста: S3 `Sparta/posts/drafts/23_05_2026-1/slide_01.png`/`slide_02.png`
  (`node tools/s3.mjs url <key>`). VK API доступен с локали напрямую; `pu.vk.com` иногда
  504 (ротация CDN) → retry со свежим `getWallUploadServer` (как уже сделано в патче).

**Фаза 1 — провайдер:**
- Переписать `uploadMedia` в `patches/vk.provider.js`: вместо messages-upload —
  `getWallUploadServer(group_id)` + `saveWallPhoto`. Сохранить retry на 504.
- Источник токена: **глобальный сервисный user-токен** (Model A), НЕ per-integration
  `integration.token`. `group_id` по-прежнему из `integration.internalId`.
- `wall.post`/`comment` — под тем же user-токеном, `from_group=1`.

**Фаза 2 — хранение+refresh токена:**
- Персистентно хранить access+refresh (refresh ротируется!). Варианты: redis/postgres
  Postiz, или отдельный мини-стор в onboard-service. Обновлять до истечения (~1 ч).
- Решить, где провайдер берёт свежий токен (env не годится — не самообновляется).

**Фаза 3 — онбординг:**
- `docs/client-onboarding.md` Шаг 5 (VK): заменить «клиент создаёт community-токен» на
  «клиент добавляет аккаунт агентства редактором группы». `register-channel.mjs`:
  для VK хранить только `group_id` (internalId), токен — глобальный сервисный.
- Community-токен можно оставить ТОЛЬКО для Chatwoot (VK-диалоги), к постингу не относится.

## Где код/факты
- Патч провайдера: `patches/vk.provider.js` (монтируется поверх dist orchestrator+backend,
  см. `docs/infra.md`). Канон — в репо.
- Связь клиент→канал: `projects/{ID}/channels.json` (`integrationId`, `internalId`=group_id).
- Регистрация каналов: `tools/onboard/register-channel.mjs` + серверный `onboard-service`.
- Сервер: `5.42.112.17`, SSH порт 22, стек `/opt/postiz-official/`. Постиз-контейнер
  ходит наружу: VK напрямую (NO_PROXY `.vk.com`,`.userapi.com`), TG через прокси.
