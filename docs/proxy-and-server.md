# Инфраструктура SMM-системы

Карта внешних сервисов. Большая часть старой серверной инфры выведена из
эксплуатации вместе с OpenClaw (16.05.2026) — см. раздел «Выведено из
эксплуатации» внизу.

## Что живо

| Сервис | Адрес | Назначение | Креды |
|---|---|---|---|
| **S3 (Timeweb)** | `s3.twcstorage.ru`, bucket `seo` | Медиа (HTML/PNG/JPG/PDF/MP4) + архив сессий | `.env`, см. `docs/s3.md` |
| **fal.ai** | API напрямую | Генерация картинок/видео/аудио, vision | `FAL_KEY` в `.env` |
| **Apify** | API напрямую | Парсинг Instagram/TikTok | `APIFY_TOKEN` в `.env` |
| **GitHub** | `maxkaymaks-web/smm-system` | Репозиторий | `GITHUB_PAT` в `.env` |

Локальный Claude Code ходит во все внешние сервисы **напрямую, без прокси**.
Не выставляй `HTTPS_PROXY`.

## LiteLLM gateway (legacy, для spend-тулзов)

LiteLLM остаётся как gateway на `5.2.66.188:4000` — сейчас используется только
для отчётов о расходе (`tools/spend.mjs`, `tools/spend-report.mjs`). Основная
работа идёт через подписку Claude Code, не через LiteLLM.

```bash
ssh -p 24822 root@5.2.66.188          # управление gateway (порт SSH 24822)
node tools/spend-report.mjs           # отчёт fal.ai / Apify / LiteLLM
```

Master key и Postgres-пароль — в `/root/litellm/.env` на проксе.
UI: `http://5.2.66.188:4000/ui` (логин — master key).

> Нужен ли LiteLLM дальше после ухода от автономных агентов — открытый вопрос
> к разработчику (см. `docs/onboarding-process.md`).

## Выведено из эксплуатации

- **RU-сервер `5.42.112.17`** (OpenClaw runtime) — gateway остановлен 16.05.2026.
- **tinyproxy `5.2.66.188:8888`** — был нужен только для исходящего трафика с
  RU-сервера; локальные запуски прокси не используют.
- **Telegram-бот / группа SEO-claw** — отключены. Диалоги — Chatwoot, публикация — Postiz, медиа — S3 (Google Drive не используем).
- **OpenClaw-кроны** (`session-watchdog`, `openclaw-logs-sync`, spend-кроны) — сняты.
