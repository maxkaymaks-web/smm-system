# Онбординг оператора — bit&pix SMM

Для оператора постов. Разработчик системы — Максим / Pavel.

## Как устроено

Все агенты (копирайтер, дизайнер, аналитик и т.д.) живут на удалённом сервере под управлением **OpenClaw**. Ты с ними общаешься через Telegram-бот @bitandpixbot или прямой чат-интерфейс.

Файлы проектов лежат на GitHub. Ты пулишь, читаешь черновики, обновляешь статусы, коммитишь.

## Установка (один раз)

### 1. Node.js + Git

- Node.js LTS: https://nodejs.org
- Git: https://git-scm.com

### 2. Клонировать репо

```bash
git clone https://github.com/maxkaymaks-web/smm-system.git
cd smm-system
npm install
```

### 3. .env

Запросить у Максима актуальный `.env` (там ключи API). Положить в корень репо. Не коммитить — он в `.gitignore`.

## Ежедневная работа

**Утром:**
```bash
cd smm-system
git pull origin main
```

В Telegram приходит ежедневный брифинг в 9:00 МСК (что делать сегодня).

**По задаче:** пиши в Telegram-бот OpenClaw — он сам понимает, диспатчит нужного агента.

Примеры команд оператора:
- «Создай пост 04 из контент-плана для BeautyCulture_DariaSopkina»
- «Статус поста 03 BeautyCulture → на согласовании»
- «Заказчик прислал ОС по посту 02 Bioprintex: «слишком сухо». Разбери через Душнилу»

**После любых изменений локально:**
```bash
git add .
git commit -m "<scope>: <что сделал> — <ProjectID>"
git push origin main
```

Скоупы: `posts`, `content-plan`, `analytics`, `feedback`.

## Что МОЖНО делать оператору

- Обновлять статусы в `content-plan.md` и `content-plan.html`
- Читать черновики в `projects/*/posts/`
- Создавать папки внутри `posts/drafts/` и `posts/inbox/`
- Запускать любых агентов через Telegram-бот
- Делать `git commit` + `push` после изменений

## Что НЕЛЬЗЯ оператору

- Изменять `voice.md`, `context.md`, `strategy.md` любого проекта
- Изменять `global/rules.md`, `CLAUDE.md`
- Изменять `tools/`, `agents/*/SOUL.md`
- Создавать новые проекты вручную (через бриф-агента)
- Удалять файлы и папки

## Статусы постов

| Статус | Значение |
|--------|----------|
| `черновик` | Не начат |
| `ждём материалы` | Ждём фото/видео от заказчика |
| `на согласовании` | Текст отправлен заказчику |
| `готово` | Заказчик одобрил, готово к публикации |
| `опубликовано` | Опубликован в соцсети |

## HTML → PDF (контент-планы и сценарии)

```bash
node tools/html-to-pdf.js projects/{ProjectID}/content-plan.html
node tools/slides-to-pdf.js projects/{ProjectID}/posts/drafts/{папка}/
```

Если не указать выходной путь — PDF сохранится рядом с HTML под тем же именем.

## Расход на LLM

```bash
node tools/spend.mjs
```

Покажет сколько потрачено за месяц и сколько осталось в бюджете.

## Проекты

- `projects/Bioprintex_Limatex/` — Лиматех / Биопринтех, B2B экология (ВК)
- `projects/BeautyCulture_DariaSopkina/` — Студия красоты «Культура», СПб (ВК)
- `projects/Lis_Gym/` — Lis Gym, фитнес-блог (Instagram Reels)
- `projects/Black_Apple/` — Black Apple, продажа iPhone, 9 городов (ВК)
- `projects/Lakmoda/` — Lakmoda, салон красоты Люберцы (Instagram)
- `projects/Sparta/` — Sparta, стратегический B2B/B2G консалтинг (Telegram)

## Если что-то сломалось

- Вопросы по системе — Максиму / Pavel
- Логи агента — на сервере через `journalctl -u openclaw`
- `tools/spend.mjs` показывает что LiteLLM жив (если падает запрос — значит проблема)
