# Онбординг оператора постов — bit&pix

## Что нужно установить (один раз)

### 1. Node.js
https://nodejs.org → скачать LTS версию, установить

### 2. Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### 3. Git
https://git-scm.com → скачать и установить (если нет)

---

## Первый запуск

### Шаг 1 — Клонировать репо
```bash
git clone https://github.com/maxkaymaks-web/smm-system.git
cd smm-system
```

### Шаг 2 — Установить скиллы Claude Code
Скиллы лежат в `skills/` — нужно скопировать в `~/.claude/skills/`:
```bash
mkdir -p ~/.claude/skills
cp -r skills/* ~/.claude/skills/
```
Это даёт Claude Code доступ к: fal-ai (генерация изображений), ежедневный-брифинг, сценарий-съёмки, директ-апи, сценарий-рилс.

> **При обновлении системы** (`git pull`) — повторить команду выше, чтобы получить свежие скиллы.

### Шаг 2а — Установить ключ fal.ai
```bash
cp global/.env.fal ~/.claude/.env.fal
```

### Шаг 3 — Авторизация Claude Code
```bash
claude
```
При первом запуске попросит API ключ — вставить ключ от Максима.

### Шаг 4 — Открыть рабочую папку
```bash
claude  # запускать всегда из папки smm-system
```
Claude Code автоматически прочитает `CLAUDE.md` и загрузит твою роль.

---

## Ежедневная работа

**Утром:**
1. Открыть Terminal → `cd smm-system` → `claude`
2. Написать: *"начинаем работу"* — Claude прочитает обновления и спросит с каким проектом работаем

**Получить актуальные файлы:**
```bash
git pull origin main
```
(запускать перед началом работы)

**После любых изменений — сохранить:**
```bash
git add .
git commit -m "posts: [что сделано] — [проект]"
git push origin main
```

---

## Структура проектов

```
smm-system/
  projects/
    Bioprintex_Limatex/       ← B2B, экология
      content-plan.md         ← контент-план (текст)
      content-plan.html       ← контент-план (визуал)
      posts/
        drafts/               ← черновики постов
        inbox/                ← материалы от заказчика
    BeautyCulture_DariaSopkina/  ← Студия красоты
      ...
    Lis_Gym/                    ← Фитнес-зал, Instagram Reels
      ...
  global/
    rules.md                  ← общие правила
    UPDATES.md                ← свежие изменения от разработчика
  agents/skills/
    copywriter/skill.md       ← как вызывать копирайтера
    designer/skill.md         ← как вызывать дизайнера
  skills/                     ← скиллы Claude Code (копировать в ~/.claude/skills/)
    fal-ai/                   ← генерация фото/видео через fal.ai
    ежедневный-брифинг/       ← утренний брифинг по проектам
    сценарий-съёмки/          ← ТЗ на съёмку для клиентов
    директ-апи/               ← создание кампаний Яндекс Директ
    сценарий-рилс/            ← сценарии Instagram Reels (для Lis_Gym)
```

---

## Конвертация HTML → PDF

Все визуальные документы системы (контент-планы, сценарии, карусели) создаются в HTML.
Для получения PDF — два инструмента в папке `tools/`.

### Документы и сценарии (один HTML → один PDF)

```bash
node tools/html-to-pdf.js <файл.html> [выход.pdf]
```

Примеры:
```bash
node tools/html-to-pdf.js projects/Lis_Gym/content-plan.html
node tools/html-to-pdf.js projects/Bioprintex_Limatex/posts/inbox/23_04_2026-konferentsiya/scenario.html scenario.pdf
```

Если `[выход.pdf]` не указан — PDF сохраняется рядом с HTML под тем же именем.

### Карусели-слайды (папка с HTML → один PDF)

```bash
node tools/slides-to-pdf.js <папка> [выход.pdf] [--quality 90] [--scale 2]
```

Примеры:
```bash
node tools/slides-to-pdf.js projects/BeautyCulture_DariaSopkina/posts/drafts/22_04_2026-1/
node tools/slides-to-pdf.js projects/Bioprintex_Limatex/posts/drafts/29_04_2026-1/ carousel.pdf --quality 85
```

Если `[выход.pdf]` не указан — PDF сохраняется в папке со слайдами как `slides.pdf`.

---

## Важно

- Ежедневный брифинг приходит **автоматически в 9:00** в Telegram @bitandpixbot
- Перед работой с любым проектом — `git pull`
- Не трогать: `voice.md`, `rules.md`, `orchestrator.md`, `tools/`, `CLAUDE.md`
- Вопросы по системе — Максиму
