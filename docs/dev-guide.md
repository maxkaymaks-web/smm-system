# Dev Guide — разработка и обучение агентов

Для разработчика системы (не оператора). Оператор работает через OpenClaw, см. `ONBOARDING.md`.

## Принципы

1. **Агенты stateless** — каждый получает полный контекст в ТЗ, ничего не помнит между запусками
2. **YAGNI** — не делать ничего «на будущее», см. `global/rules.md`
3. **Глобальные правила** — `global/rules.md` влияет на всех агентов
4. **Проектный контекст** — только в `projects/{ProjectID}/`
5. **Все LLM-вызовы через LiteLLM** — никаких прямых `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` в коде

## Структура агента

```
agents/{name}/
  SOUL.md              ← конфиг OpenClaw + system prompt
  knowledge/           ← необязательно: накопленные знания, патерны
  learning/            ← необязательно: логи автообучения (designer)
```

`SOUL.md` начинается с YAML-фронтматтера:

```yaml
---
name: copywriter
description: …
model: smm/claude-haiku-4.5
fallback_model: smm/claude-sonnet-4.6
memory_scope: agent | project | global
delegates_to: [other-agent-name]
tools: [Read, Write, Edit, Bash]
references: [skills/fal-ai/SKILL.md]
---
```

Тело файла — system prompt.

## Создать нового агента

1. `agents/{name}/SOUL.md` — фронтматтер + system prompt
2. В `agents/orchestrator/SOUL.md` → `delegates_to` добавить имя
3. В `CLAUDE.md` → таблицу агентов добавить строку
4. Коммит: `agents: add {name}`

YAGNI: не дублируй текст из `global/rules.md` в SOUL.md — оркестратор уже передаёт правила в ТЗ.

## Создать нового клиента

```bash
cp -r projects/_template projects/{ProjectID}
```

Дальше — заполнить через диалог с агентом `brief`, либо вручную:
- `context.md` — клиент, бренд, табу
- `strategy.md` — рубрикатор и KPI
- `orchestrator.md` — стартовая задача

## LiteLLM — настройка моделей

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

Автоматическое — `tools/designer_learning.py` запускается по cron (11:00 МСК), парсит Instagram через Apify по случайному стилю и пополняет `agents/designer/knowledge/references.md` + `learning/log.md`.

Веса стилей: Нежность 25%, Технологичность 25%, Промпт-инжиниринг 20%, Роскошь 15%, Энергия 15%.

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

Один `main`. Все агенты пишут синхронно (см. `global/rules.md`). Никаких worktree или копий репо.

Локально:
```bash
git pull origin main
# работа
git add . && git commit -m "<scope>: <action>" && git push origin main
```

На RU-сервере (для прод-OpenClaw):
```bash
ssh root@5.42.117.201 'cd /root/smm-system && git pull origin main'
```

Если меняешь `.env` — нужен `systemctl restart $OPENCLAW_SERVICE` на RU-сервере (см. `docs/openclaw-deploy.md`).

## Скоупы коммитов

`posts`, `content-plan`, `analytics`, `brief`, `designer`, `agents`, `tools`, `docs`, `feedback`, `litellm`.
