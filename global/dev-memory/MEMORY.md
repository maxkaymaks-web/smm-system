# Память разработчика (git, инфра/серверы/внутренняя кухня)

> ⚠️ **ТОЛЬКО ДЛЯ РАЗРАБОТЧИКА.** Это знание про инфраструктуру: серверы, SSH,
> деплой, прокси, внутренности интеграций. Читается **только в dev/`_unscoped`
> сессиях** (правка тулзов/доков/разбор багов системы). В обычной операторской
> сессии в контекст НЕ подгружается.
>
> **Оператор на серверы не лезет.** Сервер, SSH, деплой, починка сервисов — зона
> разработчика. Если что-то лежит в инфре / нужен доступ — пинг разработчику
> (Максим / Pavel), не чинить самому. См. правило о ролях в `CLAUDE.md`.

## Что сюда писать

Долгосрочные факты об инфраструктуре и внутренней кухне, которых нет в коде/доках
или которые легко забыть: серверы и доступы, грабли интеграций (Postiz/VK/Notion/
Chatwoot), особенности егресса/прокси, архитектурные решения по продуктам.

Формат: один факт = `<slug>.md` + строка в индекс. Frontmatter: `name`,
`description`, `metadata.type`. Ссылки между фактами — `[[slug]]`.

Перед тем как опереться на запись — проверь, что путь/порт/IP ещё актуальны
(инфра меняется; протухшие факты — поправить на месте).

---

- [Серверы bit&pix + egress](smm-servers-and-egress.md) — seo `5.42.112.17` (SSH **22**) + прокси `5.2.66.188` tinyproxy:8888; VK напрямую, Telegram/fal.ai/OpenAI/Anthropic — только через прокси; break-glass по голому IP
- [PAT для серверных git push](git-pat-on-server.md) — где токен на сервере, как подключён через credential.helper, симптом отставания origin/main
- [Postiz VK+TG интеграция](postiz-vk-telegram-integration.md) — VK через патч+community-токен (токены в БД PLAINTEXT!), TG родной бот; постинг через `/public/v1/posts`; org/integration id
- [VK community-токен НЕ вешает фото на стену](vk-community-token-no-wall-photos.md) — техдетали: err 27, messages-альбом -64 дропается; для фото нужен user-токен (OAuth 2.1+PKCE, ручное одобрение VK), Model A — сервисный аккаунт агентства
- [Postiz local uploads + GC](postiz-local-uploads-gc.md) — медиа на диске (STORAGE_PROVIDER=local), Postiz сам не чистит; крон `tools/postiz/uploads-gc.mjs` сносит старше 30д кроме QUEUE/DRAFT/будущих
- [Онбординг клиента без ssh](onboarding-no-ssh-tools.md) — тулы `tools/onboard/*` + серверный `onboard-service` (:4010, nginx `/onboard/`) регают каналы в БД Postiz; оператору 2 ключа
- [S3-структура архива сессий CC](session-archive-s3-layout.md) — `logs/claude-code/by-project` + by-date + `_index`; парсит/пересобирает `upload-session.mjs` (schema v2, rebuild)
- [smm-app — клиентский кабинет](smm-app-client-cabinet.md) — новый продукт (репо `reshifter1/smm-app`), Go+Gin+Next; Трек 1 (фундамент) в origin/main; Трек 2 — blue-green переезд на свежий бокс
- [Целевая архитектура — 3 окна](target-architecture-3-windows.md) — Chatwoot (чаты) + Claude Code (работа) + Postiz (превью/публикация) + Notion (БД) + S3 медиа под smm/ (Drive отклонён 14.06)
- [Секреты vs константы](secrets-vs-constants.md) — в .env только секреты (токены/ключи); не-секретные ID (Notion DB id и т.п.) — открыто в репо (`config/notion.json`)
- [Исполнение: параллель + решать самому](execution-parallelism-decisiveness.md) — при прогоне планов параллелить независимые потоки (бэк‖фронт), не дёргать тулзой по мелочам процесса
