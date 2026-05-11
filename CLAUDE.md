# SMM-система bit&pix — Claude Code entry point

Файл загружается автоматически Claude Code при `cd smm-system && claude`.
Это **локальный** режим — для разработки и разовых операторских задач.
24/7 продакшн-бот живёт на сервере под управлением OpenClaw (см. `docs/openclaw-deploy.md`).

---

## При каждом запуске — читать в этом порядке

1. `global/UPDATES.md` — свежие изменения системы (самые новые сверху)
2. `global/rules.md` — общие правила работы (включая YAGNI)
3. Спросить у пользователя: с каким проектом работаем + что делаем
4. `projects/{ProjectID}/voice.md` + `context.md` — голос и контекст клиента

---

## Что это за проект

SMM-агентство bit&pix. Стек агентов автоматизирует:
- Контент-планы (md + html + pdf)
- Тексты постов и адаптации под VK/TG/MAX/Instagram
- HTML-макеты слайдов и каруселей + fal.ai-генерация ассетов
- Анализ конкурентов через Apify/VK API
- Обработку фидбека от заказчика
- Создание новых проектов через диалог-бриф

Под капотом — LiteLLM gateway, Anthropic Claude (через OpenRouter), fal.ai, Apify.

---

## Архитектура

```
агент orchestrator
  ├─ диспатчит → copywriter, designer, analytics, brief, content-planner, dushnila
  ├─ читает  → projects/{ProjectID}/{context,voice,strategy,content-plan}.md
  └─ пишет   → projects/{ProjectID}/posts/drafts/{дата}-{N}/

LLM-вызовы (любые)
  └─→ LiteLLM (http://5.2.66.188:4000) ──→ OpenRouter ──→ Claude/DeepSeek/Gemini

Генерация изображений / видео / TTS
  └─→ fal.ai напрямую (HTTPS_PROXY через 5.2.66.188:8888 если запуск с RU IP)

Telegram-бот (только в проде)
  └─→ группа SEO-claw, 1 топик = 1 проект (см. projects/topics.json)
```

---

## Где что лежит

```
agents/<name>/SOUL.md            конфиг + system prompt каждого агента
  ├─ orchestrator       главный диспатчер
  ├─ copywriter         тексты постов
  ├─ designer           HTML/CSS + fal.ai
  ├─ analytics          Apify/VK/fal.ai-vision
  ├─ brief              создаёт новые проекты
  ├─ content-planner    контент-планы
  └─ dushnila           разбирает ОС заказчика

projects/<ProjectID>/             всё про конкретного клиента
  ├─ context.md         бриф клиента
  ├─ voice.md           голос бренда (приоритет, перекрывает всё)
  ├─ strategy.md        рубрикатор и KPI
  ├─ content-plan.md    + .html + .pdf — план месяца
  ├─ orchestrator.md    проектные оверрайды для оркестратора
  ├─ analytics/         анализ конкурентов и метрик
  ├─ feedback/          разборы ОС от заказчика
  ├─ assets/            бренд-ассеты клиента
  └─ posts/             drafts/ inbox/ approved/ published/

projects/topics.json              ProjectID → Telegram thread_id
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
  ├─ tg-topic.mjs       управление топиками SEO-claw группы
  ├─ tg-send.mjs        отправка в топик проекта (текст + PNG/PDF)
  ├─ spend.mjs          отчёт по тратам LiteLLM
  ├─ apify/             парсеры Instagram/TikTok
  └─ remotion-lakmoda/  видео-рендер для Lakmoda

skills/                           reference-доки (используются агентами)
  ├─ fal-ai/SKILL.md             полный справочник 600+ моделей fal.ai
  ├─ сценарий-рилс/SKILL.md      шаблон Instagram Reels (Lis_Gym)
  ├─ сценарий-съёмки/SKILL.md    ТЗ на съёмку клиенту
  └─ ежедневный-брифинг/SKILL.md утренний брифинг

docs/
  ├─ dev-guide.md       как разрабатывать и обучать агентов
  └─ openclaw-deploy.md как раскатать прод на RU-сервер
```

---

## Установка локально

```bash
git clone https://github.com/maxkaymaks-web/smm-system.git
cd smm-system
npm install            # @fal-ai/client, puppeteer, sharp, pdf-lib
```

Запросить у Максима `.env` (LiteLLM, FAL, Apify, VK, GitHub PAT, Telegram, S3). Положить в корень. Файл в `.gitignore`.

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

Обновление в `content-plan.md` + `content-plan.html` — немедленно после смены.

---

## Git

После любого изменения файлов проекта:

```bash
git add .
git commit -m "<scope>: <action> — <ProjectID>"
git push origin main
```

Скоупы: `posts`, `content-plan`, `analytics`, `brief`, `designer`, `agents`, `tools`, `docs`, `feedback`, `litellm`.

Локальные коммиты подхватятся на сервере при следующем `git pull` или ежечасном автопулле OpenClaw.

---

## Жёсткие запреты

- Не писать пост сам, не вызвав `copywriter`
- Не делать HTML-макет сам, не вызвав `designer`
- Не редактировать `voice.md` без явной команды пользователя
- Не пушить заметки на main без явной команды пользователя
- Никаких прямых ключей OpenAI/Anthropic/OpenRouter в коде — только `LITELLM_KEY` из `.env`
- YAGNI: не плодить «на всякий случай», не оставлять обратной совместимости после миграции (см. `global/rules.md`)

---

## Расход на LLM

```bash
node tools/spend.mjs              # сводка по virtual key smm-openclaw
node tools/spend.mjs --logs 7     # детально по моделям за 7 дней
```

LiteLLM UI: `http://5.2.66.188:4000/ui` (логин — master key из `/root/litellm/.env` на проксе).

---

## Если что-то непонятно

- `docs/dev-guide.md` — как добавить агента, обучить копирайтера, отлаживать LLM-вызов
- `docs/openclaw-deploy.md` — деплой OpenClaw на RU-сервер
- `global/UPDATES.md` — последние изменения системы
- `agents/<name>/SOUL.md` — что именно делает каждый агент
