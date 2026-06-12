# Омниканальный инбокс (VK + Telegram) — заметки по настройке

Цель: единое окно для операторов, куда стекаются диалоги из бота **VK** и бота
**Telegram**. Сейчас в проработке (см. историю в этой сессии). Кандидат на ядро —
**Chatwoot** (self-host, MIT): Telegram у него нативно, VK заводится через
«API Channel» + свой тонкий шлюз (long polling).

Сервер — RU (`seo` 5.42.117.201, SSH **порт 22**). Полное состояние серверов и
egress — в **`docs/infra.md`** (не дублируем здесь). Проверено 12.06: с сервера
`api.telegram.org` и `api.vk.com` достижимы **напрямую** (TG→302, VK→200). Telegram
периодически режется DPI в РФ → как страховку гнать через tinyproxy `5.2.66.188:8888`
(allow-лист уже включает основной сервер; креды в `PROXY_URL` на сервере).

---

## Боты и креды (в `.env`, файл в `.gitignore`)

| Что | Переменная | Значение / где взять |
|-----|-----------|----------------------|
| Telegram bot token | `TELEGRAM_BOT_TOKEN` | создан через [@BotFather](https://t.me/BotFather) → `/newbot` |
| VK community token | `VK_COMMUNITY_TOKEN` | см. процедуру ниже |
| VK group_id | `VK_GROUP_ID` | `239528257` (из ссылки `vk.com/club239528257`) |

VK-сообщество: <https://vk.com/club239528257>.

> Старый OpenClaw-бот `@seoclawww_bot` и его переменные удалены из `.env` —
> OpenClaw снесён, легаси не тащим.

---

## Как мы доставали VK-ключ сообщества (интерфейс 2026 — он перетасован)

VK в очередной раз перепрятал раздел API. Что реально сработало:

1. **Сперва включить сообщения сообщества** — БЕЗ этого раздел «Работа с API»
   вообще не появляется в меню. Управление → **Сообщения** → тумблер
   «Сообщения сообщества» → **Включены**. Там же → «Настройки для бота» →
   **Возможности ботов → ВКЛ**.

2. **Меню НЕ помогает.** Пункта «Работа с API» нет ни в основном списке, ни
   внутри «Дополнительно» (там только Авито/RSS/распознавание фото). Не трать
   время на поиск глазами.

3. **Зайти по прямой ссылке** (десктоп, не `m.vk.com`, под админом):
   ```
   https://vk.com/club<GROUP_ID>?act=tokens       # создание ключа
   https://vk.com/club<GROUP_ID>?act=longpoll_api  # включение Long Poll
   ```
   Для нашего сообщества `GROUP_ID = 239528257`.

4. **Создать ключ** → права: **Управление сообществом**, **Сообщения сообщества**,
   **Фотографии**, **Документы**. Токен начинается с `vk1.a.…`.

5. **Long Poll API** → включить, версия **5.199**, на вкладке «Типы событий» →
   **«Входящие сообщения» ВКЛ**.

### group_id из ссылки
Если ссылка на сообщество вида `vk.com/clubXXXXXXX` — `XXXXXXX` и есть group_id.
Если короткое имя (`vk.com/bitpix`) — прогнать ссылку через любой «узнать ID
группы ВК» (regram.ru/tools и т.п.).

---

## Ограничения VK, которые не обойти

- Бот **не может написать клиенту первым** — отвечаем только тем, кто сам написал
  сообществу. Холодная инициация невозможна (ограничение платформы).
- VK не отдаёт телефон через API → карточки клиентов будут неполными.

---

## Состояние сервера для Chatwoot (проверено 12.06.2026)

- **RAM — узкое место.** `seo` = 3.8 GiB всего + 2G swap, но там **уже крутится
  Postiz** (см. `infra.md`): занято ~1.4 GiB, **свободно ~2.4 GiB**. Chatwoot
  (Rails+Sidekiq+Postgres+Redis) сам хочет ~2 GiB. Вдвоём на 2 CPU / 3.8 GiB —
  тесно, риск OOM Postiz. **Решение по RAM/серверу не принято** (см. развилку ниже).
- **Порт `:3000` свободен** (Postiz занял `:5000`) — Chatwoot можно вешать на 3000.
- **Docker CE + compose уже стоят** — переиспользуем, ставить не надо.
- **HTTPS/домена нет** — это общий открытый вопрос с Postiz; разумно поднять
  **один nginx reverse-proxy на двоих** (inbox.<домен> + postiz.<домен>),
  а не дважды городить.

### Развилка по серверу (надо выбрать перед деплоем)
1. Ставить Chatwoot на тот же `seo` + апнуть RAM до 6–8 GiB (Postiz уже там).
2. Отдельный сервер под инбокс (лучше нероссийский → Telegram нативно, без прокси).
3. Взять более лёгкое ядро (FreeScout, PHP) — заметно меньше ест.

## Развёрнуто (12.06.2026)

- RAM `seo` поднята до **8 GiB** (свободно ~6) — Chatwoot и Postiz уживаются.
- Chatwoot CE (образ `chatwoot/chatwoot:latest`, 2.83 GB) развёрнут в
  **`/opt/chatwoot`** (docker-compose, отдельный проект `chatwoot`):
  - сервисы `rails` (`:3000`→наружу), `sidekiq`, `postgres` (pgvector pg16),
    `redis` (alpine). postgres/redis НЕ публикуются на хост (только внутри сети
    проекта) → нет конфликта с Postiz.
  - `.env` на сервере (`chmod 600`): сгенерированы `SECRET_KEY_BASE`,
    `POSTGRES_PASSWORD`, `REDIS_PASSWORD`; `DEFAULT_LOCALE=ru`,
    `ENABLE_ACCOUNT_SIGNUP=false`, `FRONTEND_URL=http://5.42.117.201:3000`.
  - БД инициализирована (`db:chatwoot_prepare`): 91 таблица, 135 миграций.
- **UI живой:** `http://5.42.117.201:3000` → `/installation/onboarding`
  (создание первого админа). Доступен снаружи (ufw off, как у Postiz).

## Шлюз VK+TG (реализован 12.06.2026)

Свой шлюз на long polling — HTTPS не нужен. Код в репо: `tools/chatwoot-gateway/`
(`gateway.py`, `docker-compose.yaml`, `gateway.env.example`). На сервере живёт как
сервис `gateway` в compose-проекте `chatwoot` (образ `python:3.12-slim`, ставит
зависимости при старте, код примонтирован из `/opt/chatwoot/gateway/`).

Как работает:
- **Входящие.** VK Bots Long Poll и Telegram `getUpdates` → создаём контакт/диалог/
  сообщение через **публичный API Chatwoot** (`/public/api/v1/inboxes/{identifier}/...`).
  Контакт идентифицируется как `vk:<user_id>` / `tg:<chat_id>`; маппинг
  (identifier→source_id/conversation) хранится в `/data/state.json` (volume).
- **Исходящие.** Chatwoot account-webhook (`message_created`) → `gateway:8080/chatwoot/webhook`.
  Берём только `message_type=outgoing`, маршрутизируем по префиксу identifier →
  VK `messages.send` / Telegram `sendMessage`.
- **Egress.** Telegram — через tinyproxy (`PROXY_URL`, DPI в РФ); VK и сам Chatwoot —
  напрямую (httpx-клиенты с `trust_env=False`, у TG явный `proxy=`).

Эксплуатация:
- логи: `docker compose logs -f gateway` (в `/opt/chatwoot`)
- рестарт: `docker compose restart gateway`
- два API-канала в Chatwoot: «VK» и «Telegram» (identifier'ы — в `gateway.env`).
- account-webhook зарегистрирован (`POST /api/v1/accounts/1/webhooks`).

Доступ: `http://5.42.117.201:3000`, админ `admin@bitpix.ru` (пароль — в локальном
`.env` как `CHATWOOT_ADMIN_PASSWORD`). Онбординг-флаг снят
(`Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING`), сам-регистр закрыт.

## TODO (осталось)

- [ ] **HTTPS** — сейчас голый HTTP (пароли операторов открытым текстом). Поднять
      `sslip.io`/домен + Let's Encrypt (общий nginx с Postiz). Только для безопасности —
      шлюзу HTTPS не нужен.
- [ ] **Вложения VK/TG** — пока шлюз гоняет только текст. Фото/файлы/стикеры — TODO
      (VK: двухшаговая загрузка; TG: file_id).
- [ ] Прод-харднинг шлюза: ретраи Chatwoot API, обработка закрытых диалогов,
      сборка зависимостей в образ вместо pip-at-start.
