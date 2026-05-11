# UPDATES — Изменения системы от разработчика

> Этот файл ведёт разработчик (Максим / Pavel).
> Оператор постов читает его при каждом запуске сессии.
> Самые свежие записи — сверху.

---

## 11.05.2026 (обновление 3) — OpenClaw задеплоен на RU-сервер

- **OpenClaw 2026.5.7** на `5.42.117.201`, user-systemd сервис от root, gateway loopback `127.0.0.1:18789`. EnvironmentFile подцепляет `/root/smm-system/.env` — `tools/*.mjs` (fal.ai, S3, tg-send) видят все креды.
- **Node 22 обязательно** (LTS 18 не подходит — `Array.prototype.toSorted` отсутствует, `openclaw` postinstall падает).
- **npm install — БЕЗ прокси**: registry.npmjs.org доступен с RU напрямую, а через tinyproxy CONNECT возвращает 407.
- **Новая схема `openclaw.json`** (несовместимая со старой): `agents.defaults.{workspace,repoRoot,model.primary,model.fallbacks}`, `models.providers.<id>.{baseUrl,api,apiKey,models[]}`, `channels.telegram.{groupPolicy,groupAllowFrom,groups[chat_id]}`. `defaultAgent` per-group больше не существует — оркестратор берётся как `agents.defaults.model.primary`.
- **Onboard non-interactive** — `--auth-choice custom-api-key` + `--custom-base-url $LITELLM_URL` (не `litellm-api-key`, тот хардкодит chat URL). После onboard — `openclaw config patch` для всех 6 моделей `litellm-smm/smm/*`, workspace и Telegram allowlist.
- **TELEGRAM_OWNER_ID обязателен** — без `groupAllowFrom` при `groupPolicy: allowlist` все сообщения silent-drop'аются. Берётся из `getChatAdministrators` группы (Pavel @reshifter = `1642013697`).
- **Smoke-тест прошёл**: `openclaw infer model run --model litellm-smm/smm/claude-haiku-4.5 --prompt "PONG"` → `PONG`. Цепочка OpenClaw → LiteLLM → OpenRouter → Anthropic жива.
- **`docs/openclaw-deploy.md`** переписан под фактический процесс. **`openclaw.json.example`** — новая схема (envsubst-ready).
- **Fine-grained GitHub PAT** заменён на `smm-system`-only (Contents R+W, Metadata Read). Старый широкий PAT — revoke в UI.

---

## 11.05.2026 (обновление 2) — Telegram форум-топики + S3 хранилище

- **Группа SEO-claw в Telegram** — 8 топиков:
  - `General` (thread 1) — ежедневный брифинг, общие команды
  - `tech_support` (thread 17) — техвопросы разработчику, не для клиентских обсуждений
  - 6 топиков по проектам (thread 4-9) — статусы, черновики, фидбек по клиенту
  - Маппинг ProjectID → thread_id в `projects/topics.json`
- **OpenClaw-конфиг** (`openclaw.json.example`): `dmPolicy: disabled` (ЛС никому), `groupPolicy: allowlist` (только SEO-claw), `requireMention: true` (отвечает на @упоминания)
- **tools/tg-topic.mjs** + **tools/tg-send.mjs** + **tools/get-tg-chat-id.mjs** — CLI для топиков
- **Бот → админ группы** с правом `can_manage_topics` — может сам создавать новые топики (brief агент это использует при создании нового клиента)
- **S3 (Timeweb, bucket=seo)** — всё медиа переехало туда. 187 файлов / 233 MB из `projects/*/posts/**` + `projects/*/assets/images/**` + источники брендбуков. Локально остались только тексты (`.md`, `.json`) + рабочие шрифты/логотипы для рендера HTML.
- **tools/s3.mjs** — `list/put/get/rm/sync-up/sync-down/url/exists`. **tools/migrate-to-s3.mjs** — одноразовый миграционный скрипт (с `--dry-run`, `--delete`).
- **Workflow агентов** обновлён: рендер идёт в `/tmp/{ProjectID}-{date}-{N}/`, upload в S3, send в Telegram, `rm -rf /tmp` после задачи. Сервер не перегружается.
- **docs/proxy-and-server.md** + **docs/s3.md** — карта инфры (IPs/порты/креды) и гайд по S3 для агентов и оператора.
- **.gitignore** обновлён — бинарники в `projects/*/posts/` и `projects/*/assets/images/` блокируются от случайного коммита.
- **global/rules.md** — добавлен раздел про хранение файлов (S3, не локалка).

---

## 11.05.2026 — переезд на OpenClaw + LiteLLM

- **Полный переезд с Claude Code на OpenClaw.** Все агенты (`orchestrator`, `copywriter`, `designer`, `analytics`, `brief`, `content-planner`, `dushnila`) теперь живут в `agents/<name>/SOUL.md` (формат OpenClaw). Старые `skill.md` удалены. Папка `agents/skills/` удалена как дубль.
- **LiteLLM как единственный AI-gateway** (`http://5.2.66.188:4000`, Postgres + spend tracking). Все модели под именами `smm/claude-haiku-4.5`, `smm/claude-sonnet-4.6`, `smm/claude-opus-4-7`, `smm/deepseek-v3`, `smm/gemini-2.5-flash`, `smm/gemini-2.5-pro`. Они идут через отдельный OpenRouter ключ для трекинга расхода SMM-проекта.
- **Virtual key `smm-openclaw`** с бюджетом $50/30дн. `LITELLM_KEY` в `.env`. Расход: `node tools/spend.mjs`.
- **HTTPS_PROXY** (tinyproxy на проксе 5.2.66.188:8888 с BasicAuth) прописан system-wide на RU-сервере `5.42.117.201` — `/etc/environment`, apt, git, npm видят. fal.ai/Apify/GitHub теперь доступны с RU.
- **Дефолт-модель оркестратора:** `smm/claude-sonnet-4.6`, копирайтер/аналитик/планер — `smm/claude-haiku-4.5`. Haiku в 15× дешевле Sonnet, на типовых задачах разница незаметна.
- **Креды в `.env`** (gitignored): LITELLM, FAL, APIFY, VK, GitHub PAT, S3 (Timeweb seo bucket), Swift. Шаблон — `.env.example`.
- **Душнила** — теперь полноценный агент `agents/dushnila/SOUL.md` для обработки ОС заказчика.
- **skills/директ-апи удалён** (не использовался). `skills/fal-ai`, `skills/сценарий-рилс`, `skills/сценарий-съёмки`, `skills/ежедневный-брифинг` — оставлены как reference docs для агентов.
- **YAGNI** добавлен в `global/rules.md` как явное правило.
- **Деплой OpenClaw** — делается отдельно: `docs/openclaw-deploy.md`.

---

## 05.05.2026

- **HTML → PDF: обязательный шаг** для всех контент-планов и сценариев. Инструмент: `node tools/html-to-pdf.js <файл.html>`. PDF сохраняется рядом с HTML. Скилл `контент-план.md` обновлён — шаг PDF добавлен в "Что выдаёшь". Сгенерированы PDF: `Black_Apple/content-plan.pdf`, `Lakmoda/content-plan.pdf`, `Sparta/content-plan.pdf`.
- **Lakmoda: платформа изменена ВКонтакте → Instagram** (@lakmoda). Аналитика Instagram собрана (`analytics/instagram.md`). Обновлены: `context.md` (добавлен IG-аккаунт), `strategy.md` (Reel-форматы, хэштеги 0/1-2, TOV с формулой капшна, @sodanails неактивен на IG), `content-plan.md/.html` (форматы Карусель/Фото → Reel).

---

## 30.04.2026 (обновление 2)

- **Новый проект: Black_Apple** — розничная продажа iPhone, федеральная сеть 9 городов, платформа ВКонтакте (blackapplemsk). Папка `projects/Black_Apple/`. Заполнены: `context.md` (полный бриф), `analytics/competitors.md` (MSK vs Kursk 8× разрыв + конкуренты), `strategy.md` (рубрикатор 7 рубрик S1/S2/S3/X1/E1/E2/V1, воронка 60/40, правило геолокации «Москва. Black Apple»), `content-plan.md` + `content-plan.html` (12 постов, май 2026, пропущен 9 мая). Дизайн: dark luxury + fal.ai 3D-рендеры, без участия клиента в съёмке.

- **Новый проект: Lakmoda** — салон красоты, Люберцы, платформа ВКонтакте (lakmoda_nail). Папка `projects/Lakmoda/`. Заполнены: `context.md` (бриф полный + визитка дизайн-система), `analytics/competitors.md` (4 конкурента + 3 ориентира), `strategy.md` (рубрикатор P1/P2/E1/E2/S1/V1), `content-plan.md` + `content-plan.html` (12 постов, май 2026, пропущены 1 и 9 мая). Бренд: #2f4150 + #fecabd, Bebas Neue + Raleway, пудровый минимализм.

---

## 30.04.2026

- **Новый проект: Sparta** — стратегический консалтинг B2B+B2G, платформа Telegram. Папка `projects/Sparta/`. Заполнены: `context.md` (бриф полный), `analytics/competitors.md` (4 VK + 3 TG аккаунта, медианы), `strategy.md` (рубрикатор E1/E2/E3/N1/M1), `content-plan.md` + `content-plan.html` (12 постов, май 2026). Бренд-ассеты: Gilroy + Gotham шрифты, логотипы в `assets/brand/`. Ключевое отличие стратегии: авторский голос от первого лица — ни один конкурент этого не делает.

---

## 26.04.2026 (обновление 6)

- **Скилл `сценарий-рилс` v2** — обновлён под реальную работу: анализ видео конкурентов через fal.ai vision, распознавание музыки (fal.ai + Spotify + Instagram trending), 5 типов форматов (образовательный/relatable/эстетика/вирусный/мотивация), 7 типов хуков, ротация форматов подписи. Выходной файл — HTML в дизайн-системе bit&pix + .md.
- **Lis_Gym — контент-план май 2026** создан: `content-plan.md` + `content-plan.html`. 15 рилсов, все 5 типов форматов, чередуются каждые 1–2 дня.
- **Lis_Gym — первый сценарий** готов: `posts/drafts/01_05_2026-reels-1/` — script.md + scenario.html. Формат: Образовательный (3 причины), аналог @mari_fittttttttt (1.5M просмотров), адаптирован под голос @lis.gym.

## 26.04.2026 (обновление 5)

- **Новый проект: Lis_Gym** — фитнес-блог lis.gym, платформа Instagram Reels, 15 сценариев/месяц. Папка `projects/Lis_Gym/`. Заполнены: `context.md` (клиент + аналитика конкурентов), `analytics/competitors.md` (138 рилсов, 13 аккаунтов). Стратегия в разработке.
- **Новый скилл: `сценарий-рилс`** — пишет полные сценарии Instagram Reels. Читает `context.md` + `analytics/competitors.md`, выбирает рабочий формат (из аналитики), создаёт раскадровку с хронометражем, инструкциями по съёмке, подписью и хэштегами. Шаблон выходного файла: `posts/drafts/{дата}-reels-{N}/script.md`. Установить: `cp -r skills/* ~/.claude/skills/`.

## 26.04.2026 (обновление 4)

- **Скиллы Claude Code теперь в репо** (`skills/`). Новый обязательный шаг при онбординге и после каждого `git pull`: `cp -r skills/* ~/.claude/skills/`. Это гарантирует, что все операторы используют актуальные версии.
- **fal-ai скилл обновлён** (v2): добавлена полная методология промпт-инжиниринга (`references/prompt-engineering.md`) — структура SLCT, reverse-prompt, модельно-специфичные паттерны, шаблоны для SMM. Перед любой генерацией — читать references.
- **Новые скиллы в репо:** `ежедневный-брифинг`, `сценарий-съёмки`, `директ-апи`.
- **ONBOARDING.md обновлён** — добавлен Шаг 2 «Установить скиллы».

## 26.04.2026 (обновление 3)

- **Дизайнер — ежедневное обучение** запущено. Скрипт `tools/designer_learning.py` запускается каждый день в 11:00 МСК через CCR Scheduled Task `designer-daily-learning`. Выбирает случайный стиль (A–E), парсит Instagram через Apify, обновляет `agents/designer/knowledge/references.md` и `agents/designer/learning/log.md`, шлёт отчёт в Telegram.
- **Веса стилей:** Нежность 25%, Технологичность 25%, Промпт-инжиниринг 20%, Роскошь 15%, Энергия 15%

## 26.04.2026 (обновление 2)

- **Дизайнер — fal.ai единственный инструмент** для всего: генерация, обрезка, удаление фона, апскейл, коррекция. Никаких альтернатив.
- **Дизайнер — URL на слайде запрещён.** Вместо ссылки писать: «Записывайтесь по ссылке в посте». URL только в тексте поста.

## 26.04.2026 (обновление)

- **Дизайнер — обязательный fal.ai workflow** — пустой фон теперь запрещён, введён 2-шаговый процесс:
  1. Визуальный план: паттерн из knowledge/ + fal.ai промпты для каждого слайда — ДО кода
  2. Генерация assets → сборка HTML
  - Обновлено: `agents/designer/skill.md`, `agents/skills/designer/skill.md`
  - Добавлены типовые fal.ai промпты (кожа/editorial, тёмная текстура, лёгкая текстура, ботаника)

## 26.04.2026

- **Новый агент: Душнила** — обработка ОС заказчиков (`agents/skills/душнила/skill.md`)
  - Активируется когда заказчик присылает правки (любые, даже "переделай всё")
  - Сначала читает весь контекст проекта, потом анализирует ОС
  - Если scope неясен — задаёт уточняющие вопросы (максимум 3 за раз, с вариантами)
  - На выходе: чёткое ТЗ на правки для копирайтера/дизайнера
  - Итог сохраняет в `projects/{ProjectID}/feedback/{date}-post-NN.md`

## 25.04.2026

- **Новый статус `готово`** — когда заказчик одобрил пост, ставь `готово` (не "согласовано", не "на согласовании")
- **Статус-поток:** черновик → ждём материалы → на согласовании → готово → опубликовано
- **Точка перед эмодзи не ставится.** ✅ `текст 🔬` ❌ `текст. 🔬`
- **Лиматех — название компании:** всегда "компания «Лиматех»", не "Лиматех/Биопринтех"
- **Лиматех — CTA:** только "напишите нам" (императив), не "написать нам"
- **BeautyCulture — хэштеги:** запрещены полностью
- **Лиматех — хэштеги:** пока не утверждены заказчиком, не использовать

## 24.04.2026

- Система запущена. Два активных проекта: Bioprintex_Limatex, BeautyCulture_DariaSopkina
- Ежедневный брифинг приходит автоматически в 9:00 МСК в Telegram @bitandpixbot
- Голос каждого бренда — в `projects/{ProjectID}/voice.md` (читать перед любой задачей на текст)
