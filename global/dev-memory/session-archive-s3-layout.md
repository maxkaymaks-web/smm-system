---
name: session-archive-s3-layout
description: Структура архива сессий Claude Code в S3 (logs/claude-code/by-project + by-date + _index). Заливает tools/upload-session.mjs при финализации.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 20320481-b039-4e32-925c-6495191c88d6
---

С 16.05.2026 каждая финализированная сессия CC выгружается в S3 (`s3://seo/`, Timeweb) через `node tools/upload-session.mjs <ProjectID> --summary <path>`. Цель — корпус для последующей автоматизации типовых задач без модели.

**Структура:**

```
logs/claude-code/
  by-project/
    {ProjectID|_unscoped}/
      {YYYY-MM-DD}/
        {session_id}/
          raw.jsonl    — оригинальный JSONL CC, как есть из ~/.claude/projects/...
          meta.json    — детерминистический парс (без LLM): usage по моделям,
                          tool counts, bash-команды, files read/written/edited,
                          subagents, first prompt, ai-title, duration, cc_version,
                          git_branch
          summary.md   — рукописное Hybrid-саммари от самого CC по docs/session-finalize.md
  by-date/
    {YYYY}/{MM}/{DD}/
      {session_id}.pointer.json  — {path, session_id, project_id, ai_title, started_at, ended_at}
  _index/
    all-sessions.jsonl           — append/update по session_id (read-modify-write)
```

**ProjectID** = имя папки в `projects/` (`Lakmoda`, `Sparta`, `Lis_Gym`, и т.п.) или `_unscoped` для внепроектных задач (dev, инфра, разбор багов).

**meta.json парсится в `tools/upload-session.mjs`** — это значит код истины:
- usage суммируется по моделям из `assistant.message.usage`
- tool_counts по `assistant.message.content[].type === 'tool_use'` (name)
- bash_commands, files_read/written/edited — выдёргиваются из `input` каждого tool_use
- subagents_invoked — из tool_use с name='Agent'
- duration_seconds — последний timestamp минус первый
- ai_title — берётся из event с `type === 'ai-title'` (CC сам генерит)

**Идемпотентность:** повторный запуск upload-session.mjs с тем же sid перезатрёт raw/meta/summary/pointer (полезно если CC дописал диалог после первой попытки). `_index/all-sessions.jsonl` — read-modify-write по `session_id`, дубликатов не будет.

**Каноническая схема meta = `schema_version: 2`** (поля: project_id, ai_title, started_at/ended_at, duration_seconds, usage_by_model (без `<synthetic>`), tool_counts, bash_commands, files_read/written/edited, subagents_invoked, ...). Парсер вынесен в чистую функцию `buildMeta()` — одна точка истины и для заливки, и для пересборки.

**`node tools/upload-session.mjs rebuild [--dry-run]`** (добавлено 01.06.2026) — проходит ВСЕ `raw.jsonl` в S3, перевыпускает meta.json + pointer в канонической схеме и пересобирает `_index/all-sessions.jsonl` с нуля. Чинит исторический дрейф (раньше было 3 разных формата meta) и потерю строк индекса (RMW рассыпался — было 2 строки из 12). raw.jsonl — источник истины, поэтому rebuild детерминирован. Запускать из корня репо (s3.mjs/upload-session.mjs читают `.env` из cwd). NB: индекс/folder-дата = UTC старта; длинные сессии CC идут сутками (видно по duration).

**Cost-эстимация в meta НЕ считается** — только usage в токенах. Точную цену по pricing-таблице можно посчитать позже отдельным скриптом (модели и тарифы меняются — закреплять в момент сессии нет смысла).

**OpenClaw-архив отдельно:** `s3://seo/logs/openclaw/` (исторический, заморожен 16.05.2026 — 29 сессий, 75 файлов). Не путать с новым `logs/claude-code/`.
