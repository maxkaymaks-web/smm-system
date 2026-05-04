# Dev Onboarding — Паша

Ты разработчик SMM-системы bit&pix. Работаешь вместе с Максимом, тестируешь существующий функционал и разрабатываешь новый. Эта инструкция — что установить и как настроить локалку.

---

## 1. Что установить

### Базовые инструменты
```bash
# Node.js LTS — нужен для tools/, render-html, fal.ai SDK
brew install node          # macOS
# или: https://nodejs.org

# Python 3.9+ — для daily_briefing, designer_learning, директ-апи
python3 --version          # должен быть установлен по умолчанию

# Git
git --version

# ffmpeg — для видео-монтажа (Reels, Remotion)
brew install ffmpeg
```

### Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### Опционально (для разработки)
```bash
# Remotion — для видео-монтажа React-based
# (ставится в проекте /tmp/kultura-reels/, не глобально)

# Puppeteer — нужен для render-html.js
# (устанавливается через npm install в репо)
```

---

## 2. Клонирование репо

```bash
git clone git@github.com:maxkaymaks-web/smm-system.git
cd smm-system
npm install              # ставит puppeteer и зависимости
```

---

## 3. Токены (получить у Максима лично)

`.env` — в `.gitignore`, в репо его нет. Создать руками в корне `smm-system/`:

```bash
# Содержимое отдельно скинет Максим:
# - APIFY_TOKEN (Instagram парсинг)
# - APIFY_USER_ID
# - GITHUB_PAT (для daily_briefing API)
# - VK_SERVICE_TOKEN (VK API)

# fal.ai (генерация изображений/видео) — отдельно в ~/.claude/.env.fal:
# FAL_KEY=...
```

Установить fal.ai ключ:
```bash
mkdir -p ~/.claude
# Создать файл ~/.claude/.env.fal с FAL_KEY=... (Максим даст)
```

---

## 4. Установить скиллы Claude Code

Скиллы лежат в `skills/` репо. Скопировать в `~/.claude/skills/`:

```bash
mkdir -p ~/.claude/skills
cp -r skills/* ~/.claude/skills/
```

После каждого `git pull` повторять — скиллы могли обновиться.

**Текущие скиллы:**
- `fal-ai/` — генерация изображений и видео через fal.ai (nano-banana-2, Kling, SeedVR)
- `ежедневный-брифинг/` — утренний отчёт по контент-планам
- `сценарий-съёмки/` — ТЗ на съёмку для клиентов
- `сценарий-рилс/` — сценарии Instagram Reels
- `директ-апи/` — создание кампаний в Яндекс Директ через API v5

---

## 5. Авторизация Claude Code

```bash
claude
```
При первом запуске попросит API-ключ — Максим даст.

---

## 6. Архитектура системы (быстро)

```
smm-system/
├── CLAUDE.md             ← роль Claude (оператор постов) — для прод-сессии
├── DEV_ONBOARDING.md     ← этот файл
├── ONBOARDING.md         ← для операторов (Настя)
├── docs/
│   └── dev-guide.md      ← гайд для разработки агентов
├── global/
│   ├── UPDATES.md        ← журнал изменений системы (вёл Максим)
│   ├── rules.md          ← общие правила для всех агентов
│   ├── standards.md      ← дизайн-стандарты
│   ├── brand/            ← фирстиль bit&pix (логотипы, шрифты)
│   ├── skills/           ← markdown-скиллы агентов (текстовые)
│   └── templates/        ← шаблоны постов
├── projects/             ← по одной папке на клиента
│   ├── _template/        ← шаблон для нового клиента
│   ├── BeautyCulture_DariaSopkina/   ← студия красоты, СПб
│   ├── Bioprintex_Limatex/           ← B2B экология
│   ├── Black_Apple/                  ← розница iPhone
│   ├── Lakmoda/                      ← салон красоты, Люберцы
│   ├── Lis_Gym/                      ← фитнес, Instagram Reels
│   └── Sparta/                       ← B2B консалтинг
├── agents/skills/        ← инструкции для агентов (как промпты)
│   ├── copywriter/
│   ├── designer/
│   └── душнила/          ← обработка фидбека от заказчиков
├── skills/               ← Claude Code скиллы (копируются в ~/.claude/skills/)
│   ├── fal-ai/
│   ├── ежедневный-брифинг/
│   ├── сценарий-рилс/
│   ├── сценарий-съёмки/
│   └── директ-апи/
└── tools/                ← Python/Node утилиты
    ├── daily_briefing.py        ← брифинг в Telegram (cron 9:00)
    ├── designer_learning.py     ← обучение дизайнера через Apify (cron 11:00)
    ├── render-html.js           ← Puppeteer HTML→PNG (1080×1080)
    ├── analyze-image.mjs        ← анализ изображения через fal.ai
    ├── generate-image.mjs       ← генерация через nano-banana-2
    ├── synthesize-visual.mjs    ← синтез визуала
    ├── upscale.mjs              ← апскейл через SeedVR
    ├── upscale-esrgan.mjs       ← апскейл ESRGAN
    ├── remove-bg.mjs            ← удаление фона BRIA RMBG
    └── apify/                   ← скрипты Apify-парсера
```

---

## 7. Scheduled tasks (запускаются автоматически)

Через `~/.claude/scheduled-tasks/`:

| Task | Время | Скрипт |
|------|-------|--------|
| `smm-daily-briefing` | 09:00 | `tools/daily_briefing.py` → Telegram отчёт по всем проектам |
| `designer-daily-learning` | 11:00 | `tools/designer_learning.py` → Apify Instagram → fal.ai vision → обновление `agents/designer/knowledge/` |

Проверить статус:
```
mcp__scheduled-tasks__list_scheduled_tasks
```
(в Claude Code сессии)

---

## 8. Главные команды для разработки

### Запустить тулу локально
```bash
python3 tools/daily_briefing.py
node tools/render-html.js path/to/slide.html out.png
node tools/generate-image.mjs --prompt "..." --output out.png
```

### Создать нового клиента
```bash
cp -r projects/_template projects/NewClient_Name
# Затем заполнить context.md, strategy.md, voice.md
```

### Обновить скиллы после правок
```bash
cp -r skills/* ~/.claude/skills/   # после git pull
```

### Push изменений
```bash
git add .
git commit -m "tools: <что сделано>"
git push origin main
```

⚠️ **Не коммитить токены в код** — GitHub Secret Scanning блокирует. Использовать `.env` (gitignored).

---

## 9. Текущие проекты и их статус

- **Bioprintex_Limatex** — B2B, экология (ВКонтакте, активный)
- **BeautyCulture_DariaSopkina** — студия красоты СПб (ВКонтакте, активный)
- **Lis_Gym** — фитнес, Instagram Reels (15 рилсов/мес, активный)
- **Black_Apple** — розница iPhone (ВКонтакте, на старте)
- **Lakmoda** — салон красоты Люберцы (Instagram, на старте)
- **Sparta** — B2B консалтинг (Telegram, на старте)

Каждый клиент имеет:
- `context.md` — бриф клиента
- `voice.md` — голос бренда (тон, фразы, табу)
- `strategy.md` — стратегия
- `content-plan.md/.html` — план постов на месяц
- `posts/drafts/` — черновики
- `posts/inbox/` — материалы от заказчика
- `feedback/` — обработанная ОС от заказчиков
- `analytics/` — анализ конкурентов

---

## 10. Что делает Максим / что делает Паша

**Максим** — продакт, общается с клиентами, операторы (Настя). Использует свою сессию для оперативной работы (роль = оператор, см. `CLAUDE.md`).

**Паша** — разработчик, тестирует и улучшает систему:
- Новые скиллы в `skills/`
- Новые тулы в `tools/`
- Архитектура агентов в `agents/`
- Автоматизации (scheduled tasks)
- Багфиксы и оптимизация существующего

Работаем через GitHub PR / прямые коммиты в `main`.

---

## 11. Связь

Вопросы по системе — Максим. Проблемы с сессией / скиллами — пиши в чат.
