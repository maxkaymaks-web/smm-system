---
project_id: Sparta
task_type: новый-пост
task_subtype: пострелиз-2-постера
status: success
difficulty: easy
automation_potential: medium
reusable_recipe: true
tags: [sparta, тверь, пострелиз, постер, telegram]
---

## Что просили

Оператор подтвердил готовность поста #09 на 23.05.2026 (Тверь, тренинг по предпринимательским компетенциям, рубрика M1 — Пострелиз). Задача: залить пост в S3-хранилище, обновить статус на «готово» в контент-плане, финализировать сессию по docs/session-finalize.md.

## Inputs (что нужно для повтора)

- materials: готовые файлы в `projects/Sparta/posts/drafts/23_05_2026-1/` — post.md (1335 знаков), poster1.html, poster2.html, slide_01.png (1.5 MB), slide_02.png (1.3 MB)
- knowledge: content-plan.md — пост #09, 23.05, рубрика M1 «Пострелиз», статус «готово»; docs/session-finalize.md — процедура финализации
- constraints: статус «готово» = одобрено заказчиком; медиа (PNG/HTML) хранятся в S3, не в git
- external: нет

## Recipe (шаги решения)

### Шаг 1 — Идентификация последнего поста

**Что делал:** прочитал content-plan.md, определил последний готовый пост — #09 (23_05_2026-1, Тверь пострелиз).

**Результат:** папка `projects/Sparta/posts/drafts/23_05_2026-1/` с 5 файлами. Статус уже «готово» в content-plan.md — обновление не потребовалось.

**Длительность:** ~5s.

### Шаг 2 — Загрузка поста в S3

**Что делал:** запустил `sync-up` для папки поста.

**Команда:**
```
node tools/s3.mjs sync-up projects/Sparta/posts/drafts/23_05_2026-1/ Sparta/posts/drafts/23_05_2026-1/
```

**Результат:** 5 файлов загружены успешно (post.md, poster1.html, poster2.html, slide_01.png 1.5 MB, slide_02.png 1.3 MB).

**Длительность:** ~8s.

## Tools (цепочка, для машинного парсинга)

`Read(content-plan.md) → Read(session-finalize.md) → Read(post.md) → PowerShell(s3 sync-up) → PowerShell(upload-session.mjs)`

## Artifacts (что осталось)

- S3: `Sparta/posts/drafts/23_05_2026-1/` — 5 файлов
- content-plan.md: пост #09 статус «готово» (был установлен ранее)

## Decisions / отклонения

- Статус в content-plan.md уже был «готово» — обновление не потребовалось.
- Использовал PowerShell вместо Bash: на Windows с кириллицей в пути пользователя Bash через WSL не видит директорию.

## Lessons / разбор ошибок и инцидентов

### 1. Bash-инструмент не работает с кириллицей в пути

При `cd /mnt/c/Users/Пользователь/...` через Bash путь с кириллицей не разрешился. Та же проблема с Windows-стилем через Bash-инструмент.

**Как починил:** переключился на PowerShell.

**Как не повторить:** на этой машине всегда использовать PowerShell для node/git команд. Bash — только для инструментов, не требующих смены директории.

## Что можно автоматизировать

- ✅ sync-up в S3: кнопка «залить» по ProjectID + дате, без LLM
- ✅ Обновление статуса: UI-кнопка или git-hook
- ⚠️ Написание summary: LLM нужен, но шаблон стабилен
