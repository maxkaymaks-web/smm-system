# SMM-система bit&pix — OpenClaw runtime

Этот файл — точка входа для **OpenClaw** (LLM-агент рантайм).
Здесь нет Claude Code, нет `Agent tool`, нет `~/.claude/skills/`.

## Архитектура

```
OpenClaw агенты ──► LiteLLM proxy (5.2.66.188:4000) ──► OpenRouter ──► Claude/DeepSeek/Gemini
                            │
                            └─ Postgres ── spend tracking
        fal.ai (генерация) ─┐
                             ├─► tinyproxy (5.2.66.188:8888) ──► внешний интернет
                Apify / VK ─┘                 (для RU-сервера)
```

- **LiteLLM virtual key** (`LITELLM_KEY` в `.env`) — единственный credential для LLM-вызовов
- **Все модели** под именем `smm/<provider>-<model>` (см. `docs/openclaw-deploy.md`)
- **Бюджет** — $50/30 дней на virtual key, факт-расход в `tools/spend.mjs`

## Агенты

Каждый агент — папка `agents/<name>/` с файлом `SOUL.md` (config + system prompt).

| Агент | Назначение | Default-модель |
|---|---|---|
| `orchestrator` | Главный диспатчер, принимает запросы оператора | `smm/claude-sonnet-4.6` |
| `copywriter` | Пишет посты по ТЗ | `smm/claude-haiku-4.5` |
| `designer` | HTML-макеты + fal.ai генерация | `smm/claude-sonnet-4.6` |
| `analytics` | Apify/VK/fal.ai-vision, конкуренты | `smm/claude-haiku-4.5` |
| `brief` | Создаёт новый проект через диалог | `smm/claude-sonnet-4.6` |
| `content-planner` | Контент-план месяца, HTML+PDF | `smm/claude-haiku-4.5` |
| `dushnila` | Разбирает ОС заказчика → чёткое ТЗ для копирайтера/дизайнера | `smm/claude-sonnet-4.6` |

## Что читать при старте

1. `global/rules.md` — общие правила работы (включая YAGNI)
2. `global/UPDATES.md` — последние изменения системы
3. Выбрать проект → `projects/{ProjectID}/context.md` + `voice.md`
4. Контекстная задача — из последнего сообщения оператора

## Проекты

- `projects/Bioprintex_Limatex/` — B2B, промышленная экология (ВКонтакте)
- `projects/BeautyCulture_DariaSopkina/` — Студия красоты «Культура», СПб (ВКонтакте)
- `projects/Lis_Gym/` — Фитнес-зал, Instagram Reels, СПб
- `projects/Black_Apple/` — Розничная сеть iPhone, 9 городов (ВКонтакте)
- `projects/Lakmoda/` — Салон красоты, Люберцы (Instagram)
- `projects/Sparta/` — B2B/B2G стратегический консалтинг (Telegram)
- `projects/_template/` — эталон файловой структуры для новых проектов

## Статусы постов

| Статус | Значение |
|--------|----------|
| `черновик` | Не начат |
| `ждём материалы` | Ждём фото/видео от заказчика |
| `на согласовании` | Текст отправлен заказчику |
| `готово` | Заказчик одобрил, готово к публикации |
| `опубликовано` | Опубликован в соцсети |

## Git

После любого изменения файлов проекта — немедленно:

```
git add .
git commit -m "<scope>: <action> — <ProjectID>"
git push origin main
```

Скоупы коммитов: `posts`, `content-plan`, `analytics`, `brief`, `designer`, `agents`, `tools`, `docs`.

## Деплой / обновление

- Развёртывание OpenClaw — `docs/openclaw-deploy.md` (делает разработчик)
- Точка трекинга расходов — `node tools/spend.mjs`
- Конфиг LiteLLM (модели, ключи провайдеров) — на проксе `5.2.66.188:/root/litellm/`
