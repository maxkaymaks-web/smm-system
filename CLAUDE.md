# SMM-система bit&pix — Claude Code entry point

Файл загружается автоматически Claude Code при `cd smm-system && claude`.
Основной режим: оператор запускает `claude` руками из репозитория и работает
с ним как с сильным помощником. **1 задача = 1 сессия.** По окончании сессии
(с подтверждения оператора) транскрипт + саммари выгружаются в архив
(`docs/session-finalize.md`).

> Видение и процесс зафиксированы: интервью начальника — `docs/onboarding-process.md`,
> целевая архитектура и план — `docs/superpowers/specs/2026-06-12-notion-gdrive-integration-design.md`.
> Где что хранится **сейчас vs цель** — `docs/storage.md`.

---

## Новая модель работы (коротко)

Раньше посты генерировались автономными агентами (через OpenClaw-бота в
Telegram). **Это отключено.** Теперь:

- **Оператор ведёт много проектов параллельно** — сам делает посты, заполняет
  контентом, держит окна задач. Таких операторов несколько.
- **Claude Code (ты) = сильный помощник.** Знаешь типовые решения агентства:
  как пишем посты, как верстаем, как разбираем ОС, как поступаем в разных
  ситуациях. Помогаешь оператору, а не делаешь всё за него автономно.
- **Агенты-эксперты** (`copywriter`, `designer`, `analytics`, `brief`,
  `content-planner`, `dushnila`) — нативные сабагенты Claude Code в
  `.claude/agents/<name>.md`. Зови их через Agent tool, когда это ускоряет
  работу. Это **не обязаловка**: оператор может работать и напрямую с тобой.
- **Финальную публикацию всегда жмёт человек.** Нейросеть сама в соцсети ничего
  не публикует.

### Три окна + Notion за ними

- **Chatwoot** — клиентские диалоги, омниканал TG/VK/MAX. Развёрнут.
- **Claude Code (ты)** — основной рабочий экран: подсказываешь что следующим,
  вместе с оператором делаешь пост, пушишь в Postiz, ведёшь Notion.
- **Postiz** — превью перед публикацией; человек жмёт ок/публикацию. Кандидат,
  допиливается (см. `docs/postiz-integration.md`).
- **Notion** — БД/источник истины операционки (базы «Клиенты»/«Планы»/«Посты»)
  + Kanban для начальника. Ведёшь ты; начальник смотрит/иногда правит.

---

## При каждом запуске — читать в этом порядке

1. `global/UPDATES.md` — свежие изменения системы (самые новые сверху)
2. `global/rules.md` — общие правила работы (включая YAGNI)
3. Спросить у оператора: с каким проектом работаем + что делаем
4. `projects/{ProjectID}/voice.md` + `context.md` — голос и контекст клиента

---

## При завершении сессии — финализация

Когда задача сделана и оператор подтвердил, что качество устраивает
(«всё ок», «закрываемся», «финализируй», `/finalize` и т.п.) — прочитай
**`docs/session-finalize.md`** и выполни процедуру: напиши `summary.md` по
шаблону, запусти `node tools/upload-session.mjs <ProjectID> --summary ...`.

Перед финализацией **обязательно опроси оператора**:
- «Точно всё сделали по задаче?»
- «Делал что-то вне Claude Code (руками, в другом окне)? Опиши — зафиксирую
  в саммари.» — это важно, чтобы лог сессии был полным для последующего
  анализа паттернов «что сработало / что нет».

Без явного подтверждения оператора не финализируй. Цель — накопить корпус
сессий (JSONL + meta + summary), который потом раз в неделю/месяц
анализируется: хорошие паттерны выносятся в документацию, плохие — в стоп-лист.

---

## Что это за проект

SMM-агентство bit&pix. Помогаешь оператору делать:
- Контент-планы (ведутся в Notion; клиенту уходит PDF-снапшот)
- Тексты постов и адаптации под VK/MAX/Instagram/Telegram
- HTML-макеты слайдов и каруселей + fal.ai-генерация ассетов
- Анализ конкурентов через Apify/VK API
- Обработку фидбека от заказчика
- Создание новых проектов через диалог-бриф (см. `docs/client-onboarding.md`)

Под капотом — Claude через подписку Claude Code (Anthropic),
fal.ai (картинки/видео), Apify (парсинг).

---

## Архитектура

```
оператор + Claude Code (claude в этом репо)
  ├─ при необходимости зовёт сабагентов-экспертов через Agent tool:
  │   copywriter, designer, analytics, brief, content-planner, dushnila
  │   (.claude/agents/<name>.md)
  ├─ читает  → projects/{ProjectID}/{context,voice,strategy,overrides}.md  (git)
  ├─ ведёт   → Notion: базы «Клиенты»/«Планы»/«Посты» (операционка, источник истины)
  ├─ пишет   → projects/{ProjectID}/posts/drafts/{дата}-{N}/ (рабочие черновики)
  ├─ пушит   → Postiz (готовый пост на превью → человек публикует)
  └─ в конце → upload-session.mjs → архив сессий (см. docs/session-finalize.md)

Генерация изображений / видео / TTS
  └─→ fal.ai напрямую (без прокси).

Хранилища (подробно — docs/storage.md):
  • Операционка (статусы, план, задачи)  → Notion (источник истины)
  • Знания клиента (context/voice/strategy/overrides) + ноу-хау → git
  • Медиа (HTML/PNG/JPG/PDF/MP4)          → S3 Timeweb, бакет seo, префикс smm/
                                            (Google Drive рассматривали — отказались)
  • Архив сессий Claude Code              → S3 (logs/claude-code/…)
  Локально файлы — временные в /tmp.

Диалоги с клиентом   → Chatwoot (TG/VK/MAX).
Публикация           → Postiz (человек жмёт финальную кнопку).
```

---

## Онбординг и публикация (без ssh)

- Форма-бриф клиенту: дай ссылку **https://survey.bitandpix.ru**; забрать ответы —
  `node tools/intake/check.mjs` (список) / `--get <key>` (целиком). Это Шаг 0.
- Завести/править клиента: `tools/onboard/new-client.mjs`, `edit-client.mjs`
  (репо-скелет + карточка Notion). Подключить соцканалы:
  `tools/onboard/register-channel.mjs` (VK community-токен / TG-канал → Postiz).
- Связка клиент→канал — в `projects/{ID}/channels.json` (`integrationId`).
- Публикация: Postiz public API (`upload-from-url` ×N → `/posts`,
  `settings.__type`), реальные токены соцсетей держит Postiz. Детали —
  `docs/postiz-integration.md`, полный флоу — `docs/client-onboarding.md`.

---

## Где что лежит

```
.claude/agents/<name>.md         сабагенты-эксперты Claude Code (system prompt + frontmatter)
  ├─ copywriter         тексты постов
  ├─ designer           HTML/CSS + fal.ai
  ├─ analytics          Apify/VK/fal.ai-vision
  ├─ brief              создаёт новые проекты
  ├─ content-planner    контент-планы
  └─ dushnila           разбирает ОС заказчика

agents/<name>/                    база знаний агентов (НЕ system prompt):
  ├─ brief/questions.md           33 вопроса брифа (Q33 — мастер-вопрос)
  └─ designer/knowledge/          накопленные дизайн-референсы

config/notion.json                ID баз Notion (НЕ секрет; секрет — NOTION_TOKEN в .env)

projects/<ProjectID>/             всё про конкретного клиента (знания — в git)
  ├─ context.md         бриф клиента
  ├─ voice.md           голос бренда (приоритет, перекрывает всё)
  ├─ strategy.md        рубрикатор и KPI (внутренний, клиенту не показываем)
  ├─ overrides.md       «личное дело»: табу, дизайн-спеки, «запомни/не делай»
  ├─ analytics/         анализ конкурентов и метрик
  ├─ feedback/          разборы ОС от заказчика
  ├─ assets/            бренд-ассеты клиента
  └─ posts/             drafts/ inbox/ approved/ published/
  (операционка — статусы/план/очередь — теперь в Notion, не в content-plan.md)

projects/_template/               эталон файловой структуры

global/
  ├─ rules.md           общие правила (читать всегда)
  ├─ UPDATES.md         changelog от разработчика (читать первым)
  ├─ standards.md       чек-лист контроля качества постов
  ├─ brand/             шрифты и логотип агентства bit&pix
  └─ templates/         базовые HTML-шаблоны

tools/                            утилиты (Node.js + Python)
  ├─ render-html.js     HTML → PNG через Puppeteer
  ├─ html-to-pdf.js     один HTML → PDF
  ├─ slides-to-pdf.js   папка с HTML → один PDF
  ├─ generate-image.mjs fal.ai генерация
  ├─ analyze-image.mjs  fal.ai vision (анализ референсов)
  ├─ remove-bg.mjs      fal.ai BRIA убирает фон
  ├─ upscale.mjs        fal.ai SeedVR2 апскейл
  ├─ s3.mjs             S3 CRUD (медиа сейчас + архив сессий)
  ├─ chatwoot-gateway/  шлюз VK+TG ↔ Chatwoot
  ├─ onboard/new-client.mjs       завести клиента (репо + Notion), без ssh
  ├─ onboard/edit-client.mjs      править поля клиента в Notion + overrides
  ├─ onboard/register-channel.mjs подключить VK/TG канал в Postiz, без ssh
  ├─ onboard-service/             серверный сервис регистрации каналов (на сервере)
  ├─ lib/notion.mjs               обёртка Notion API
  ├─ upload-session.mjs выгрузка финализированной сессии CC в архив
  ├─ spend-report.mjs   отчёт по тратам (fal.ai / Apify)
  ├─ apify/             парсеры Instagram/TikTok
  └─ remotion-lakmoda/  видео-рендер для Lakmoda

.claude/skills/                   скиллы Claude Code (автодискавер; используются агентами)
  ├─ fal-ai/SKILL.md             полный справочник 600+ моделей fal.ai
  ├─ сценарий-рилс/SKILL.md      шаблон Instagram Reels (Lis_Gym)
  ├─ сценарий-съёмки/SKILL.md    ТЗ на съёмку клиенту
  └─ ежедневный-брифинг/SKILL.md обзор «что делать следующим» (поверх Notion)

docs/
  ├─ onboarding-process.md интервью начальника (видение + процесс)
  ├─ client-onboarding.md  SOP заведения нового клиента (бриф → Notion → Drive)
  ├─ storage.md            где что хранится: сейчас vs цель
  ├─ access-setup.md       подключение Notion + доступ к медиа S3 (креды)
  ├─ postiz-integration.md публикация: подключение каналов в Postiz
  ├─ s3.md                 S3: медиа сейчас + архив сессий
  ├─ dev-guide.md          как разрабатывать и обучать агентов
  ├─ session-finalize.md   процедура финализации сессии в конце задачи
  └─ superpowers/specs/    дизайн-спеки (интеграция Notion/Drive/Postiz)
```

---

## Установка локально

```bash
git clone https://github.com/maxkaymaks-web/smm-system.git
cd smm-system
npm install            # @fal-ai/client, puppeteer, sharp, pdf-lib
```

Запросить у Максима креды (см. `docs/access-setup.md`): `.env`
(FAL, Apify, VK, GitHub PAT, S3, `NOTION_TOKEN`). Положить в корень.
Секреты в `.gitignore`.

Запуск:
```bash
claude          # Claude Code сам прочитает этот CLAUDE.md
```

---

## Статусы постов

| Статус | Значение |
|--------|----------|
| `черновик` | Не начат |
| `ждём материалы` | Ждём фото/видео от заказчика |
| `на согласовании` | Текст отправлен заказчику |
| `готово` | Заказчик одобрил, готово к публикации |
| `опубликовано` | Опубликован в соцсети |

Статус ведётся в **Notion (база «Посты»)** — источник истины. Обновляй немедленно
после смены. (Старый трекер `content-plan.md` ретайрнут.)

---

## Git

После изменения файлов проекта — предложи закоммитить и запушить, но
**сначала спроси подтверждение оператора**. Не коммить и не пушь автоматически.

```bash
git add .
git commit -m "<scope>: <action> — <ProjectID>"
git push origin main
```

Скоупы: `posts`, `content-plan`, `analytics`, `brief`, `designer`, `agents`, `tools`, `docs`, `feedback`, `memory`.

---

## Правила

- Не редактировать `voice.md` без явной команды оператора
- Коммит и пуш разрешены, но **каждый раз спрашивать подтверждение оператора**
  перед `git commit` и `git push` (не автоматически)
- Секреты — только в `.env`. Не-секретные константы (ID баз Notion и т.п.) —
  открыто в репо (`config/notion.json`)
- YAGNI: не плодить «на всякий случай», не оставлять обратной совместимости после миграции (см. `global/rules.md`)

---

## Если что-то непонятно

- `docs/notion-access.md` — как ходить в Notion (через прямой API, не MCP)
- `docs/client-onboarding.md` — как завести нового клиента (бриф → Notion → Drive)
- `docs/storage.md` — где что хранится (сейчас vs цель)
- `docs/onboarding-process.md` — видение и процесс от начальника
- `docs/dev-guide.md` — как добавить агента, обучить копирайтера, отлаживать
- `docs/session-finalize.md` — финализация сессии в конце задачи
- `global/UPDATES.md` — последние изменения системы
- `.claude/agents/<name>.md` — что именно делает каждый агент-эксперт
