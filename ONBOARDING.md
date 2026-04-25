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

### Шаг 2 — Авторизация Claude Code
```bash
claude
```
При первом запуске попросит API ключ — вставить ключ от Максима.

### Шаг 3 — Открыть рабочую папку
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
  global/
    rules.md                  ← общие правила
    UPDATES.md                ← свежие изменения от разработчика
  agents/skills/
    copywriter/skill.md       ← как вызывать копирайтера
    designer/skill.md         ← как вызывать дизайнера
```

---

## Важно

- Ежедневный брифинг приходит **автоматически в 9:00** в Telegram @bitandpixbot
- Перед работой с любым проектом — `git pull`
- Не трогать: `voice.md`, `rules.md`, `orchestrator.md`, `tools/`, `CLAUDE.md`
- Вопросы по системе — Максиму
