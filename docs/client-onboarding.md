# Онбординг нового клиента — SOP

Полный путь заведения клиента в новой модели: бриф → локальные файлы → Notion → медиа →
каналы. Состояние на **14.06.2026** (где шаг ещё не разблокирован — помечено ⏳).

> Роли: агент `brief` (через Agent tool) ведёт бриф и создаёт локальную структуру.
> Шаги в Notion/Drive/каналах выполняет оператор + Claude Code по этому SOP.
> Карта хранилищ — `docs/storage.md`. Доступы/креды — `docs/access-setup.md`.

## Шаг 0. Форма-бриф клиенту (опционально, без звонка)

Чтобы не опрашивать клиента вживую — дай ему ссылку на анкету:
**https://survey.bitandpix.ru** (32 вопроса брифа, секции, прогресс-бар; на
вступительном экране — TG оператора, можно надиктовать голосовым вместо текста).

Ответ клиента падает в S3. Забрать — по токену, S3-креды не нужны (нужны
`SURVEY_API_URL` + `SURVEY_API_KEY` в `.env`):

    node tools/intake/check.mjs                 # список заявок (свежие сверху)
    node tools/intake/check.mjs --get <key>     # одна заявка целиком (вопрос→ответ)

Дальше Claude по ответам заводит проект (Шаг 2) и заполняет context/voice/strategy.
Сервис — `tools/survey-service/` (дизайн: `docs/superpowers/specs/2026-06-20-survey-intake-form-design.md`).

## Шаг 1. Бриф

Зови агента `brief` (или работай напрямую). Вопросы — `agents/brief/questions.md`
(33 вопроса, 9 секций). **Q33 — мастер-вопрос от Максима, высший приоритет** по
поведению/алгоритму проекта. Этого набора достаточно для старта.

Что обязательно проговаривается с человеком (не выдумывать): **аудитория, тональность**
и прочая чувствительная информация. На сложных нишах **фантазировать про ЦА запрещено** —
нужны реальные данные.

## Шаг 2. Завести клиента (скелет + Notion) — одной командой

    node tools/onboard/new-client.mjs --id {ProjectID} --name "{Имя}" \
      --platforms VK,Telegram --operator "{оператор}" --focus "{фокус}"

Создаёт `projects/{ProjectID}/` из `_template`, карточку в базе «Клиенты» и план-черновик,
плюс `channels.json` (реестр каналов). Идемпотентно. Дальше заполняешь
context/voice/strategy руками/через brief.

> `ProjectID` — транслит названия без пробелов (напр. `BeautyCulture_DariaSopkina`).
> `strategy.md` — **внутренний** «сухой» документ (JTBD + боли/триггеры). Клиенту **не показываем**.
> Аналитику конкурентов — через агента `analytics` (Apify/VK), в `projects/{ID}/analytics/`.

## Шаг 3. Notion — карточка, план, посты

Источник истины операционки. ID баз — `config/notion.json`, токен — `NOTION_TOKEN`.

> Карточка клиента (база «Клиенты») и план-черновик (база «Планы») уже созданы тулом
> на Шаге 2. Здесь доводим до ума вручную то, что тул не заполняет автоматически.

1. **База «Клиенты»** → проверить/дополнить карточку: Папка медиа (ссылка), уточнить поля.
2. **База «Планы»** → уточнить период, перевести статус из `черновик` по готовности
   (`на согласовании у клиента` → `утверждён` → `в работе` → `закрыт`).
3. **База «Посты»** → строки создаются контент-флоу (content-planner + Notion): Title,
   связь с Клиентом и Планом, Дедлайн, Платформа, Статус (`черновик`…`опубликовано`),
   Рубрика, Формат, Приоритет.

Доска начальника — вид Board базы «Посты», группировка по «Статус» (создаётся в UI
один раз; Notion API виды не создаёт).

## Шаг 4. Медиа

Медиа клиента — в **S3** (бакет `seo`) под префиксом `smm/projects/{ProjectID}/`
(`posts/`, `assets/`). Тул — `tools/s3.mjs`. Директор/клиент смотрят через **Cyberduck**
или presigned-ссылки (`node tools/s3.mjs url <ключ>`). Ссылку на медиа кладём в карточку
клиента (Notion) и поле «Ассеты» постов. (Google Drive не используем — `docs/storage.md`.)

## Шаг 5. Подключить каналы — без ssh

    # VK: клиент создаёт community-токен (вкладка «Работа с API» сообщества)
    node tools/onboard/register-channel.mjs --id {ProjectID} --type vk --group-id {GID} --token {vk1.a...}
    # Telegram: добавить @bit_and_pix_bot админом канала, затем
    node tools/onboard/register-channel.mjs --id {ProjectID} --type telegram --chat-id {-100...}

Тул пишет канал в Postiz через onboard-service и сохраняет `integrationId` в
`projects/{ProjectID}/channels.json`. Публикация — Postiz API по этому id
(см. `docs/postiz-integration.md`). Правки клиента: `node tools/onboard/edit-client.mjs --id {ProjectID} ...`.

- **Диалоги:** подключить каналы клиента (TG/VK/MAX) в Chatwoot (`tools/chatwoot-gateway/`) — отдельный шаг, вручную.

## Шаг 6. Первый контент-план клиенту

Стратегию клиенту **не показываем** — первым на согласование уходит **контент-план на
месяц**. Генерим PDF-снапшот из данных Notion (`html→pdf` пайплайн), кладём в медиа-папку,
отправляем через Chatwoot. **Два уровня согласования:** сначала план целиком (клиент
одобряет состав/темы), затем каждый готовый пост отдельно. Финальную публикацию жмёт человек.

## Шаг 7. Публикация: черновик в Postiz

Когда пост готов (текст согласован, медиа в S3) — создаём черновик в Postiz:

1. **Загрузи медиа** (если есть картинки) — по одной через `upload-from-url`:
   ```bash
   # presign URL в S3
   node tools/s3.mjs url smm/projects/{ProjectID}/posts/drafts/{дата}-{N}/{file}.png 3600
   # загрузить в Postiz → получишь {id, path}
   curl -s -X POST "$POSTIZ_API_URL/api/public/v1/upload-from-url" \
     -H "Authorization: $POSTIZ_API_KEY" -H "Content-Type: application/json" \
     -d '{"url": "<presigned_url>"}'
   ```

2. **Создай черновик** — `POST /api/public/v1/posts` с `type=draft`:
   ```json
   {
     "type": "draft",
     "date": "<ISO>",
     "shortLink": false,
     "tags": [],
     "posts": [
       { "integration": {"id": "<vk_integrationId>"},
         "value": [{"content": "<текст>", "image": [{"id":"...", "path":"..."}]}],
         "settings": {"__type": "vk"} },
       { "integration": {"id": "<tg_integrationId>"},
         "value": [{"content": "<текст>", "image": [{"id":"...", "path":"..."}]}],
         "settings": {"__type": "telegram"} }
     ]
   }
   ```
   `integrationId` — из `projects/{ProjectID}/channels.json`.

3. **Дай оператору ссылку:** `https://tech.bitandpix.ru` → он открывает, видит черновик
   во вкладке «Drafts», проверяет и нажимает «Publish». **Финальную кнопку жмёт человек.**

> Только `type=draft` — никогда `type=now` из кода агента без явной команды оператора.

## Чек-лист

- [ ] Бриф снят (Q33 учтён), ЦА/тональность согласованы с человеком
- [ ] `projects/{ProjectID}/` создан и заполнен — `new-client.mjs` + context/voice/strategy/overrides руками
- [ ] Аналитика конкурентов собрана (агент `analytics`)
- [ ] Notion: карточка + план созданы тулом (Шаг 2); строки-посты — контент-флоу; Board-вид настроен
- [ ] Медиа-папка заведена в S3, ссылка в карточке Notion
- [ ] Каналы подключены (`register-channel.mjs` → Postiz; Chatwoot — вручную)
- [ ] Контент-план отправлен клиенту на согласование (PDF)
- [ ] Черновики созданы в Postiz (`type=draft`), оператор нажал Publish
