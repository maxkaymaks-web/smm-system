# SMM-система bit&pix — Сессия разработчика

> Если ты разработчик (Паша) — переименуй этот файл в `CLAUDE.md` локально, чтобы Claude Code читал именно его. Или просто прочитай его при старте сессии.

Ты — ассистент разработчика SMM-системы bit&pix. В этой сессии работает разработчик, не оператор постов.

---

## При каждом запуске — читать в этом порядке

1. `DEV_ONBOARDING.md` — инфра, токены, архитектура (для контекста)
2. `global/UPDATES.md` — свежие изменения системы
3. `docs/dev-guide.md` — гайд по разработке агентов
4. Спросить у разработчика: над чем работаем сегодня?

---

## Что разработчик МОЖЕТ делать (всё)

- Создавать/менять скиллы в `skills/` и `agents/skills/`
- Менять тулы в `tools/`
- Менять `global/rules.md`, `global/standards.md`
- Менять `CLAUDE.md`, `ONBOARDING.md`, `DEV_ONBOARDING.md`
- Создавать новых клиентов (`cp -r projects/_template projects/...`)
- Менять структуру проектов
- Обновлять `global/UPDATES.md` после каждого изменения системы
- Менять scheduled tasks (`~/.claude/scheduled-tasks/`)
- Чинить продовые баги
- Делать архитектурные изменения

## Что разработчик НЕ ДЕЛАЕТ

- ❌ Не публикует посты за оператора
- ❌ Не меняет voice.md / context.md / strategy.md действующих клиентов без согласия Максима
- ❌ Не пушит токены в код (использует `.env`, который в `.gitignore`)
- ❌ Не использует `--no-verify` / `--force-push` без явной просьбы Максима

---

## Ключевые правила разработки

### Токены — только через `.env`
```bash
# Локальный .env в корне smm-system/ — gitignored
# Скрипты читают его так:
python3 -c "
from pathlib import Path
env = {}
for line in Path('.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
print(env['GITHUB_PAT'])
"
```

Шаблон чтения `.env` для нового скрипта — см. `tools/daily_briefing.py` строки 1–18.

### Git — обязательно после каждого изменения системы
```bash
git add .
git commit -m "<scope>: <что сделано>"
git push origin main
```

Префиксы коммитов:
- `tools:` — изменения в `tools/`
- `skills:` — изменения в `skills/` или `agents/skills/`
- `agents:` — изменения логики агентов
- `posts:` — действия с черновиками постов (для оператора)
- `learning:` — выгрузки от designer_learning
- `strategy:` / `content-plan:` — план/стратегия проекта
- `infra:` — инфраструктура, сетап
- `docs:` — документация

### UPDATES.md — обязательно после изменения системы
После любых изменений структуры/функционала — записать в `global/UPDATES.md` (новые сверху). Триггеры — см. CLAUDE.md, секция «SMM-система: лог изменений».

### Скиллы — синхронизация с локалкой
После правок в `skills/*` — оператору нужно `cp -r skills/* ~/.claude/skills/` после git pull. Учитывать это при коммите.

---

## Архитектура — короткая шпаргалка

```
Слой 1: Глобальные правила (global/)
  → действуют на все проекты, на всех агентов

Слой 2: Проектный контекст (projects/{client}/)
  → специфика клиента: voice, context, strategy

Слой 3: Агенты (agents/)
  → stateless, получают контекст в ТЗ
  → copywriter, designer, душнила, orchestrator

Слой 4: Скиллы Claude Code (skills/)
  → fal-ai, директ-апи, сценарий-рилс и т.д.
  → копируются в ~/.claude/skills/

Слой 5: Тулы (tools/)
  → Python/Node-скрипты: рендер, парсинг, API-вызовы
  → запускаются вручную или через scheduled tasks
```

---

## Текущие активные интеграции

- **fal.ai** — генерация изображений/видео, апскейл, удаление фона, vision-анализ
- **Apify** — Instagram-парсинг (designer_learning)
- **GitHub API** — daily_briefing читает контент-планы
- **Telegram Bot** — отчёты в @bitandpixbot
- **VK API** — публикация (в разработке)
- **Yandex Direct API v5** — создание кампаний

---

## Чем сейчас занимается Максим

Оперативная работа с операторами + клиентами. См. `global/UPDATES.md` для свежего статуса проектов.

---

## Куда смотреть сразу

| Что | Где |
|-----|-----|
| Что нового в системе | `global/UPDATES.md` (свежие сверху) |
| Как создавать агентов | `docs/dev-guide.md` |
| Структура проекта | `projects/_template/` |
| Шаблон чтения `.env` | `tools/daily_briefing.py` 1–18 |
| Шаблон Apify+fal.ai pipeline | `tools/designer_learning.py` |
| Шаблон render HTML | `tools/render-html.js` |
| Скиллы операторов | `skills/` |
| Голос для копирайтера | `agents/copywriter/skill.md` |
| Дизайн-патерны | `agents/designer/knowledge/` |
| Brand guidelines | `global/brand/design-system.md` |
