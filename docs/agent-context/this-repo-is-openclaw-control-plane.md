---
name: this-repo-is-manual-cc-workflow
description: "smm-system — ручной режим Codex (1 задача = 1 сессия). С 11.06.2026 идёт смена концепции: оператор ведёт много проектов, CC = помощник; Telegram вырезан целиком, OpenClaw снесён. Процесс описывает начальник через docs/onboarding-process.md."
metadata:
  node_type: memory
  type: project
---

Режим: оператор открывает `cd smm-system && codex` руками, делает одну задачу, в конце финализирует через `node tools/upload-session.mjs <ProjectID> --summary /tmp/session-summary.md` -> JSONL + meta + summary в S3 (см. [session-archive-s3-layout](session-archive-s3-layout.md), `docs/session-finalize.md`).

**Смена концепции (11.06.2026, коммит fe5d33c):** ушли от «автономные агенты генерят посты» к «**оператор (девочки) ведёт много проектов параллельно, Codex = сильный помощник с типовыми решениями**». Операторов несколько. Агенты (`copywriter`/`designer`/etc) теперь **модули экспертизы, помощь не обязаловка** — жёсткие запреты «не пиши без copywriter» сняты, orchestrator удалён.

**Что вырезано под корень:** весь Telegram (`tg-*`, `topics.json`, `spend-send`), OpenClaw-артефакты (`agents/orchestrator`, `openclaw-deploy.md`, `openclaw.json.example`, `ONBOARDING.md`, `openclaw-logs-sync`, `spend-per-msg`, `migrate-to-s3`, `setup-cron`, `daily_briefing.py`), designer-автообучение (`designer_learning.py` + `agents/designer/learning/`). `daily_briefing.py` содержал утёкший TG bot-токен — отозвать у @BotFather. Per-project `orchestrator.md` → `overrides.md`.

**Why:** OpenClaw отключён 16.05.2026 (бюджет LiteLLM key `smm-openclaw` исчерпан); затем решили перестроить всю модель под живых операторов + CC-помощника, а не чинить автобота.

**How to apply:**
- «посмотри что бот делает» / «он завис» — **бота нет, это норма**. Уточни задачу, сделай в текущей сессии. Не лезь в `ssh ... systemctl openclaw`.
- **Отправки в Telegram нет.** Доставка готового клиенту планируется через **Google Drive** (тул реализует разработчик, пока может отсутствовать). Не предлагай tg-send.
- **Отложено до интервью с начальником** (`docs/onboarding-process.md`): рерайт агентов→модули, логирование под майнинг паттернов, **Notion как CRM** (операционка/статусы), переезд медиа+логов S3→Google Drive, судьба LiteLLM. Когда user говорит «я начальник» — провести интервью по тому доку, **только записать ответы, ничего не реализовывать** (реализует разработчик).
- Финализация: перед выгрузкой опросить оператора «всё ли сделано» и «делал ли что-то вне CC» (новое требование, в `docs/session-finalize.md`).
- Доступ к серверу 5.42.117.201 — только форензика историчных логов (см. [openclaw-server-access](openclaw-server-access.md)).
