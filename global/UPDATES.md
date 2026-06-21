# UPDATES — Изменения системы от разработчика

> Этот файл ведёт разработчик (Максим / Pavel).
> Оператор постов читает его при каждом запуске сессии.
> Самые свежие записи — сверху.

---

## 2026-06-20 — Форма-бриф клиенту (анкета по ссылке)
Клиента больше не обязательно опрашивать вживую — есть онлайн-анкета на 32 вопроса
брифа: **https://survey.bitandpix.ru** (секции, прогресс-бар, на вступительном
экране TG оператора — можно надиктовать голосовым вместо текста). Отдай ссылку
клиенту, ответ упадёт в S3.

**Забрать заполненное (любой оператор/агент с доступом к репо):**

    node tools/intake/check.mjs                 # список заявок (свежие сверху)
    node tools/intake/check.mjs --get <key>     # одна заявка целиком (вопрос→ответ)

Ходит в read-API по токену (`SURVEY_API_URL` + `SURVEY_API_KEY` в `.env`),
S3-креды не нужны. Дальше по ответам заводишь проект (`new-client.mjs`) и
заполняешь context/voice/strategy. Это **Шаг 0** онбординга — `docs/client-onboarding.md`.
Сервис — `tools/survey-service/`, дизайн — `docs/superpowers/specs/2026-06-20-survey-intake-form-design.md`.

---

## 2026-06-14 — Онбординг клиента без ssh
Появились тулы `tools/onboard/{new-client,edit-client,register-channel}.mjs`:
оператор заводит/правит клиента и подключает VK/TG каналы по HTTPS, без ssh и
без ручной правки БД. Каналы регистрирует серверный `onboard-service`. Секреты
у оператора — только `NOTION_TOKEN` + `ONBOARD_API_KEY`. Флоу — docs/client-onboarding.md.

---

## 14.06.2026 (3) — Claude Code wiring (чтобы всё подтягивалось «само»)

Аудит: что описано в доках ≠ что Claude Code реально автозагружает. Починено:
- **Скиллы переехали `skills/` → `.claude/skills/`** — только там CC их автодискаверит.
  Добавлен frontmatter (`name`/`description`) в `ежедневный-брифинг/SKILL.md` (без него
  скилл не грузился). Ссылки `skills/…` в агентах/доках обновлены.
- **Notion MCP подключён:** добавлен `.mcp.json` (сервер `notion` через
  `npx @notionhq/notion-mcp-server`, токен `${NOTION_TOKEN}`). ⚠️ Чтобы CC подставил
  токен — он должен быть **в окружении** при запуске: `set -a; source .env; set +a` →
  `claude` → подтвердить project MCP-сервер. Статус — `/mcp`. (См. `docs/access-setup.md`.)
- **Сабагенты `.claude/agents/`** — 6 шт., frontmatter валиден; copywriter получил
  явный `tools: Read, Write`. (Отсутствие `tools` = наследование всех — не баг.)

---

## 14.06.2026 (2) — отказ от Google Drive, остаёмся на S3 (префикс `smm/`)

- **Переезд медиа на Google Drive отменён** (после ресёрча). Причины: сервис-аккаунты
  после 15.04.2025 не пишут в личный My Drive; Workspace+Shared Drive не оплатить из РФ
  (санкции); личный Drive через OAuth — хрупко и привязано к одному аккаунту. S3 уже
  работает, RU-родной, дёшев, headless-надёжен, team-safe.
- **Медиа остаётся на S3**, но теперь **всё под префиксом `smm/`** (не в корне бакета):
  `smm/projects/{ProjectID}/posts/…` и `…/assets/`. Архив сессий — отдельно (`logs/claude-code/…`).
- **Просмотр для человека:** директору — Cyberduck/S3 Browser/веб-панель Timeweb; клиентам —
  presigned-ссылки (`tools/s3.mjs url`). Это и закрывало единственную причину хотеть Drive.
- Обновлены: `storage.md`, `s3.md`, `access-setup.md` (выкинут Drive-раздел), `CLAUDE.md`,
  `rules.md`, спека (Компонент 2), `client-onboarding.md`, designer-агент, `.env.example`
  (убраны `GOOGLE_*`). Фаза 3 «Drive» — выкинута. Google service-account ключ не нужен.

---

## 14.06.2026 — Notion-операционка живой + доки под Claude Code

- **Notion как операционка — внедрено.** Созданы базы «Клиенты»/«Планы»/«Посты»
  (связи `Клиенты ──< Планы ──< Посты`), 6 проектов мигрированы (77 постов). ID баз —
  открыто в `config/notion.json`, токен — `NOTION_TOKEN` в `.env`. Операционная роль
  `content-plan.md` ретайрнута: статусы/план/очередь теперь в Notion.
- **Агенты переведены под Claude Code.** Старый OpenClaw-формат `agents/*/SOUL.md`
  (`memory_scope`/`knowledge`/`references`) → нативные сабагенты `.claude/agents/*.md`
  (frontmatter + system prompt, вызов через Agent tool). Базы знаний остались в
  `agents/<name>/knowledge/` (+ `brief/questions.md`).
- **Новые доки:** `docs/storage.md` (где что хранится — сейчас vs цель),
  `docs/client-onboarding.md` (полный SOP заведения клиента: бриф → Notion → Drive →
  каналы), `docs/access-setup.md` (поправлены SA-email и имя ключа на фактические).
- **Архитектура «3 окна»:** Chatwoot (диалоги) + Claude Code (работа) + Postiz
  (превью/публикация, кандидат) + Notion (БД) + Drive (медиа, Фаза 3, ещё не внедрён —
  медиа пока в S3). Дизайн — `docs/superpowers/specs/2026-06-12-notion-gdrive-integration-design.md`.
- **Правки правил:** `CLAUDE.md` и `global/rules.md` переписаны под новую модель;
  git-правило — коммит/пуш только с подтверждением оператора (убрано «пушим
  немедленно»); зафиксировано «секреты в `.env`, константы открыто».
- **Блокеры:** Drive (Фаза 3) ждёт `GDRIVE_ROOT_FOLDER_ID` + расшаренную папку;
  Postiz — не финал, изолируется за `tools/publish.mjs`.

---

## 11.06.2026 — смена концепции + большая зачистка

- **Новая модель работы.** Уход от «автономные агенты генерят посты» к «оператор
  ведёт много проектов параллельно, Claude Code = сильный помощник с типовыми
  решениями». Операторов несколько, у каждого много проектов. Реализацию всей
  обвязки делает разработчик; будущий процесс описывает начальник.
- **Telegram отменён полностью.** Доставка готового клиенту переезжает на Google
  Drive (тул у разработчика). Удалены: `tools/tg-send.mjs`, `tg-topic.mjs`,
  `get-tg-chat-id.mjs`, `tg-set-commands.mjs`, `spend-send.mjs`, `projects/topics.json`.
  Все TG-упоминания вычищены из `CLAUDE.md`, `global/rules.md`, `agents/*`, `docs/*`.
- **OpenClaw — снос артефактов.** Удалены: `agents/orchestrator/` (диспатчер был
  только под TG-автобот), `docs/openclaw-deploy.md`, `openclaw.json.example`,
  `ONBOARDING.md` (описывал OpenClaw/TG-онбординг), `tools/openclaw-logs-sync.mjs`,
  `tools/spend-per-msg.mjs`, `tools/migrate-to-s3.mjs` (миграция отработала),
  `tools/setup-cron.sh`, `tools/daily_briefing.py` (TG-крон, плюс в нём был утёкший
  bot-токен — отозвать у @BotFather).
- **Дизайнер-автообучение снято.** Удалены `tools/designer_learning.py` и
  `agents/designer/learning/` (логи крона). Накопленная база `agents/designer/knowledge/`
  оставлена — пополняется вручную.
- **Жёсткие запреты сняты.** «Не писать пост без copywriter / не верстать без
  designer» убрано из `CLAUDE.md` — агенты теперь модули экспертизы (помощь, не
  обязаловка), а не звенья обязательного оркестратора.
- **Логирование** остаётся в S3 как есть. Добавлено: перед финализацией оператора
  опрашивают «всё ли сделано» и «делал ли что-то вне CC» — чтобы лог был полным
  для будущего анализа паттернов. Переезд логов/медиа на Google Drive и
  операционка в Notion — отложено до интервью с начальником (`docs/onboarding-process.md`).
- **Заготовка под начальника:** `docs/onboarding-process.md` — куда начальник
  надиктовывает процесс + блок открытых вопросов для интервью.

---

## 17.05.2026 — HTTPS_PROXY больше не относится к локальному CC

- **Правило:** прокси `5.2.66.188:8888` нужен ТОЛЬКО для запусков с RU-сервера `5.42.117.201` (исторический OpenClaw, выключен 16.05.2026). Локальный `claude` в этом репо ходит во внешние сервисы (fal.ai, Apify, GitHub) напрямую — никакого `HTTPS_PROXY` ни в `.env`, ни в окружении задавать не надо.
- **Почему правка:** в `CLAUDE.md`, `global/rules.md`, `agents/designer/SOUL.md`, `skills/fal-ai/SKILL.md` и тексте ошибок `tools/generate-image.mjs` оставались формулировки в стиле «трафик идёт через `HTTPS_PROXY` из `.env`», которые сбивали локальную сессию: агент пытался выставлять прокси или подозревать его в любом сетевом фейле.
- **Что осталось без изменений:** `docs/proxy-and-server.md` (инфра-док про сервер) и `docs/openclaw-deploy.md` (исторический деплой OpenClaw) — там прокси описан корректно в серверном контексте.

---

## 16.05.2026 — уход от OpenClaw, ручной Claude Code + архив сессий

- **OpenClaw на 5.42.117.201 отключён.** `openclaw-gateway.service` остановлен (stop + disable), оба root-cron'а (`session-watchdog.mjs` ежеминутный, `openclaw-logs-sync.mjs` daily 03:00) сняты. Последний финальный sync прошёл вручную (29 сессий / 75 файлов в `s3://seo/logs/openclaw/`, дельта после 16.05 03:00 — 6 файлов / 0.67 MB). Бинарь OpenClaw в `/usr/lib/node_modules`, `/root/.openclaw/`, конфиги — **не тронуты** (rollback одним `systemctl start`); полный cleanup отдельной задачей через 1-2 недели.
- **Причина:** бюджет LiteLLM virtual key smm-openclaw исчерпан 16.05 ($50.07/$50); gateway бесполезно спамил `FailoverError`. Текущий формат «бот в TG отвечает сам на @mention» решено больше не поддерживать.
- **Новый рабочий режим:** операторы запускают `cd smm-system && claude` руками, **1 задача = 1 сессия**. Это всё. Никаких 24/7-сервисов, никакого LiteLLM в горячем пути.
- **Архив сессий CC в S3.** В конце задачи (с подтверждения оператора) Claude Code:
  1. Пишет `summary.md` по шаблону **Hybrid YAML + recipe + narrative** в `/tmp/`.
  2. Запускает `node tools/upload-session.mjs <ProjectID> --summary /tmp/session-summary.md`.
  3. В S3 уходит 5 объектов:
     - `logs/claude-code/by-project/{ProjectID}/{YYYY-MM-DD}/{sid}/{raw.jsonl,meta.json,summary.md}`
     - `logs/claude-code/by-date/{YYYY}/{MM}/{DD}/{sid}.pointer.json` (короткий json со ссылкой)
     - `logs/claude-code/_index/all-sessions.jsonl` (read-modify-write по `session_id`)
- **`meta.json` — детерминистический** (парсится из JSONL CC без LLM): usage по моделям, tool counts, bash-команды, files read/written/edited, subagents, первый prompt, ai-title, duration, model, cc_version, git_branch. См. `tools/upload-session.mjs`.
- **`summary.md` пишет сам CC по своему же контексту** (никаких дополнительных LLM-вызовов и платы за саммаризацию). Формат — `docs/session-finalize.md`: frontmatter (`project_id`, `task_type` из таксономии 15 значений, `status`, `difficulty`, `automation_potential`, `reusable_recipe`, `tags`) + блоки «Что просили / Inputs / Recipe / Tools / Artifacts / Decisions / Lessons / Что автоматизировать» + опциональные раскрытия ТЗ к подагентам.
- **Цель корпуса** — научиться повторять типовые задачи через UI «без нейронок»: накапливаем рецепты, поверх индекса позже строится сайтик с кнопками.
- **Удалено:** `tools/session-watchdog.mjs` (был полезен только при живом OpenClaw — уведомлял в TG о таймаутах сессий бота).
- **Не тронуто:** `tools/openclaw-logs-sync.mjs` (оставлен в репо как рабочий снапшоттер историчного `logs/openclaw/` префикса в S3 — можно запустить руками при необходимости).
- **CLAUDE.md** переписан: вверху — указание читать `docs/session-finalize.md` в конце сессии, секция «Архитектура» обновлена (нет «Telegram-бот в проде»), есть упоминание `upload-session.mjs` в `tools/`.

---

## 14.05.2026 — архив сессий OpenClaw в S3

- **`tools/openclaw-logs-sync.mjs`** — ежедневная (cron 03:00 на 5.42.117.201) выгрузка всех session JSONL (`*.jsonl`, `*.trajectory.jsonl`, `*.trajectory-path.json`, `*.jsonl.reset.*`) из `/root/.openclaw/agents/main/sessions/` в `s3://seo/logs/openclaw/{YYYY}/{MM}/{DD}/{file}`. Партиция — по дате первого event'а в JSONL (день рождения сессии), а не по mtime — благодаря чему растущая сессия не «разъезжается» по разным датам.
- **Идемпотентность через `x-amz-meta-srcmtime` + `srcsize`**: повторный запуск пропускает неизменённые файлы (`skipped=N`); активные сессии переливаются на следующий день автоматически (S3 PUT перезаписывает).
- **Снимок индекса**: `sessions.json` агента дополнительно копируется в `logs/openclaw/_index/sessions-{YYYY-MM-DD}.json` — даёт точку отсчёта «какие сессии были живы на конец суток».
- **Зачем**: накопить корпус реальных кейсов использования (полный prompt + system prompt + messagesSnapshot + tool calls/results) для последующего разбора и обучения. JSONL OpenClaw содержит всё необходимое — этот скрипт только архивирует.
- На сервере доустановлен `@aws-sdk/client-s3` + `lib-storage` + `s3-request-presigner` (раньше декларировались в `package.json`, но `node_modules` на сервере были без них — `tools/s3.mjs` и связанные тулзы по факту были сломаны).

---

## 12.05.2026 — политика text-to-image: только nano-banana-2 и gpt-image-2

- **Жёсткое ограничение по моделям генерации картинок.** В проекте разрешены ровно две t2i-модели: `fal-ai/nano-banana-2` (дефолт, всё подряд) и `openai/gpt-image-2` (только когда нужен разборчивый длинный/мульти-язычный/типографский текст на картинке). Любые другие — Flux всех версий, Ideogram, Recraft, Seedream, Imagen, Qwen, SDXL, Nano Banana Pro и пр. — больше не используются.
- **`tools/generate-image.mjs`** теперь принимает `--model=nano-banana-2|gpt-image-2` и `--quality=low|medium|high` (для gpt-image-2). Маппит `aspect_ratio` → `image_size` preset fal.ai. Whitelist моделей зашит в CLI — попытка вызвать чужую завершится ошибкой.
- **`skills/fal-ai/SKILL.md`** + **`references/prompt-engineering.md`** переписаны: убраны таблицы альтернативных t2i и edit-моделей (Flux Fill/Kontext/LoRA, Ideogram, и пр.), оставлены только nano-banana-2 + gpt-image-2 с правилом выбора. Утилиты (bria, seedvr, esrgan), видео (Kling/Veo/Sora/etc), аудио, any-llm — без изменений.
- **`agents/designer/SOUL.md`** — добавлен явный блок «Выбор text-to-image модели — строго две» с примерами CLI.
- **`global/rules.md`** — раздел про fal.ai дополнен жёсткой политикой моделей.
- **`tools/lib/fal-prices.json`** — добавлена строка `openai/gpt-image-2` для трекинга расхода (variants по `quality`).
- **Зачем:** избежать дрейфа агентов на «универсальные» модели вроде Flux, держать стабильное качество nano-banana-2 как базы и точечный gpt-image-2 для типографики.

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
