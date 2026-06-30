---
name: smm-app-client-cabinet
description: "Новый продукт — клиентский личный кабинет bit&pix (репо smm-app), старт проектирования 29.06.2026"
metadata: 
  node_type: memory
  type: project
  originSessionId: ca32baef-d635-427b-9ff1-636028522cb7
---

Отдельный продукт agency bit&pix: клиентский **личный кабинет** (логин клиентов,
позже — автопостинг, авто-DM «ответили в директ», контент-планы, аналитика, AI).
Начат 2026-06-29. Сейчас строим только **фундамент** (Трек 1): голый каркас —
auth + роли + feature-флаги + заглушка, без продуктовых фич.

**Зафиксированные решения:**
- Репо: приватный `reshifter1/smm-app` (владелец Pavel, НЕ org maxkaymaks-web), лежит `/home/pavel/projects/smm-app`. Монорепо `backend/` + `frontend/`.
- Стек: **Go 1.25 + Gin** (копия loveka), pgx/v5 raw SQL, миграции goose, Postgres 17. Фронт — Next.js 16 + React 19 + Tailwind v4 + TS «строго как соседние проекты».
- Auth: серверные сессии (НЕ JWT), argon2id, opaque-токен (в БД sha256), кука HttpOnly. Открытая саморегистрация; сброс пароля вручную через Telegram админу.
- Роли: `client`(дефолт)/`tester`/`operator`/`admin`. Гейтинг сервер+UI по списку ролей.
- Feature-флаги = **константы в коде** (`features.go`) + роли; «включить всем» = поменять AllowedRoles и задеплоить. Real-time-конфига нет и не вводим.
- Дизайн: токены лендинга bitandpix.ru (Smink) — тёмный tech-brutalist, акцент `#FF1E1E`, заголовки Casaygon капсом, тело Natasans, pill-кнопки. Шрифты достать у заказчика.
- Поддомен `app.bitandpix.ru`.

**Деплой — топология A, миграция BLUE-GREEN на свежем боксе (финал, решение оператора):**
Поднять новый сервер (**4ГБ+своп 4ГБ**, регион seo; образы собирать ВНЕ бокса — иначе
next build/Chatwoot ловят OOM), поставить Dokku, развернуть там Chatwoot+gateway+survey+
кабинет, перенести данные. **Cutover через перенос прод-IP** на новый бокс (быстрее DNS,
без TTL) — IP-своп ПОСЛЕДНИМ шагом, не первым (иначе chat ляжет на часы). seo живёт
горячим откатом, потом убивается. **Бросаем Postiz + onboard-service**, переносим
survey-service (survey.bitandpix.ru) и chatwoot-gateway (мост VK/TG) — иначе умрут со
старым боксом. Это **Трек 2** (отдельная спека); Трек 1 от него не зависит.
Предусловие: проверить в Timeweb что прод-IP отвязывается (floating); иначе фолбэк DNS TTL 60с.
Критичные риски Chatwoot: ① точный SECRET_KEY_BASE из /opt/chatwoot/.env (иначе шифрованные
колонки нечитаемы); ② вложения на ЛОКАЛЬНОМ диске (ACTIVE_STORAGE_SERVICE=local) — rsync тома;
③ gateway state.json; ④ pgvector pg16 (pg18 крашит dokku-postgres), дамп
`pg_dump -Fc --no-owner --no-acl` → `dokku postgres:import`; LE из RU → DNS-01.
seo = 5.42.112.17:22 (НЕ .117.201).

**Трек 1 (фундамент) РЕАЛИЗОВАН и в origin/main** (2026-06-29, subagent-driven, 27 коммитов).
Что готово: Go+Gin бэк (домен/приложение/инфра/презентация + arch-тест слоёв), pgx+goose
(миграции users/sessions, embed, `./api migrate`), argon2id + серверные сессии (кука
smmapp_session, в БД только sha256), роли+RequireRole, feature-флаги-как-код + /me, rate-limit;
Next.js фронт (login/register/authed-layout+sidebar из /me/заглушка+демо-вкладки), дизайн-токены
bit&pix (Unbounded/Onest, НЕ Inter). Тесты: бэк cover 81.5% (gate 80, `make cover` с
-tags=integration+pg), фронт 100%/97.56% (vitest gate 90/80). Деплой-артефакты под Dokku
готовы (Dockerfile'ы собираются: бэк 44MB/фронт 214MB, Procfile web+release, app.json,
nginx.conf.sigil, CI). Команды: `make be t=test|cover|lint`, `make fe t=fe-test`; dev-pg на :5433;
первый admin — вручную `UPDATE users SET role='admin'`. Финальное opus-ревью: READY TO MERGE.
Отложено в Трек 2: `smm-app/docs/track2-backlog.md` (restore requireRole-проп, trusted-proxy
для rate-limit, session-sweeper и пр. — все non-blocking).

Спека Трека 1: `smm-app/docs/specs/2026-06-29-cabinet-foundation-design.md`.
План: `smm-app/docs/superpowers/plans/2026-06-29-cabinet-foundation-track1.md`.
Связано: [[smm-servers-and-egress]] [[target-architecture-3-windows]].
