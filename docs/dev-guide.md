# Dev Guide — разработка и обучение агентов

Для разработчика системы (не оператора). Оператор работает через Claude Code
напрямую — точка входа `CLAUDE.md`.

## Принципы

1. **Агенты stateless** — каждый получает полный контекст в ТЗ, ничего не помнит между запусками
2. **YAGNI** — не делать ничего «на будущее», см. `global/rules.md`
3. **Глобальные правила** — `global/rules.md` влияет на всех агентов
4. **Проектный контекст** — только в `projects/{ProjectID}/`
5. **Никаких прямых ключей** (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `FAL_KEY`) в коде — только из `.env`

## Структура агента

Агенты-эксперты — нативные сабагенты Claude Code, вызываются через Agent tool:

```
.claude/agents/{name}.md   ← frontmatter + system prompt
agents/{name}/knowledge/   ← необязательно: накопленная база знаний агента
```

Frontmatter — формат Claude Code:

```yaml
---
name: copywriter
description: когда звать агента (триггер для Agent tool)
tools: Read, Write, Edit, Bash   # опционально; без поля — наследует все
---
```

Тело файла — system prompt. (Старый OpenClaw-формат `agents/{name}/SOUL.md` с полями
`memory_scope`/`knowledge`/`references` снят — Claude Code их не читает.)

## Создать нового агента

1. `.claude/agents/{name}.md` — frontmatter (name/description/tools) + system prompt
2. База знаний (если нужна) — в `agents/{name}/knowledge/`, агент читает её сам
3. В `CLAUDE.md` и `global/rules.md` → таблицу агентов добавить строку
4. Коммит: `agents: add {name}`

YAGNI: не дублируй текст из `global/rules.md` в агента — он передаётся в ТЗ.

## Создать нового клиента

Полный SOP (бриф → локальные файлы → Notion → Drive → каналы) — `docs/client-onboarding.md`.
Локальная часть кратко:

```bash
cp -r projects/_template projects/{ProjectID}
```

Дальше — заполнить через диалог с агентом `brief`, либо вручную:
- `context.md` — клиент, бренд, табу
- `strategy.md` — рубрикатор и KPI
- `overrides.md` — проектные оверрайды (табу, дизайн-спеки, следующая задача)

## LiteLLM — настройка моделей (legacy)

> LiteLLM остался только для spend-тулзов; основная работа идёт через подписку
> Claude Code. Раздел актуален, если LiteLLM-gateway всё ещё используется.

Конфиг живёт на проксе: `5.2.66.188:/root/litellm/config.yaml`.

Добавить новую модель:

```bash
ssh -p 24822 root@5.2.66.188
cd /root/litellm
# редактировать config.yaml
docker compose restart litellm
```

Создать новый virtual key (для другого проекта или подсистемы):

```bash
curl -sS -X POST http://127.0.0.1:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key_alias":"smm-experimental","models":["smm/*"],"max_budget":10,"budget_duration":"30d"}'
```

Master key и Postgres-пароль — в `/root/litellm/.env`.

## Обучение копирайтера

1. Собрать 3–5 постов с ER выше среднего → `agents/copywriter/knowledge/hooks.md`
2. Найти паттерн (структура крючка, тип CTA, длина, рубрика)
3. Обновить `agents/copywriter/knowledge/patterns.md`
4. Запустить агента на той же задаче → сравнить

## Обучение дизайнера

Накопленный справочник стилей и композиций — `agents/designer/knowledge/`
(`references.md`, `compositions.md`, `feedback_log.md`). Пополняется вручную:
нашёл удачный приём/референс → допиши в `references.md` или `compositions.md`.

> Старое автообучение через cron (`designer_learning.py`, Apify + Telegram-отчёт)
> снято вместе с OpenClaw — осталась только накопленная база знаний.

## Отладка LLM-вызова

Все запросы логируются в Postgres LiteLLM. Посмотреть последние:

```bash
ssh -p 24822 root@5.2.66.188 \
  'curl -sS "http://127.0.0.1:4000/spend/logs?limit=20" \
   -H "Authorization: Bearer $LITELLM_MASTER_KEY" | python3 -m json.tool | head -80'
```

Или подключиться к UI: `http://5.2.66.188:4000/ui` (логин — master key).

## Расход проекта

```bash
node tools/spend.mjs              # сводка
node tools/spend.mjs --logs 7     # детально по моделям за 7 дней
```

## Git-флоу

Один `main`. Никаких worktree или копий репо.

```bash
git pull origin main
# работа
git add . && git commit -m "<scope>: <action>" && git push origin main
```

## Скоупы коммитов

`posts`, `content-plan`, `analytics`, `brief`, `designer`, `agents`, `tools`, `docs`, `feedback`.
