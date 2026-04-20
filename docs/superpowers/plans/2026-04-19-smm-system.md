# SMM Agent System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить многоагентную SMM-систему на Claude Code: универсальные агенты-исполнители + проектные оркестраторы + глобальные правила + рабочее место для девочки.

**Architecture:** Variant B — universal executor agents (copywriter, designer, content-planner, analytics) receive full TZ from per-project orchestrators. Global rules layer (`global/rules.md`) propagates to all agents across all projects. GitHub repo with `main` (dev) and `girl` (SMM girl) branches.

**Tech Stack:** Claude Code skills (markdown), Node.js + Puppeteer (HTML→PNG), Bash (sync scripts), GitHub

---

## File Map

### Created in this plan

```
smm-system/
  .gitignore
  package.json                          ← Node.js, puppeteer dep
  global/
    rules.md                            ← formatting, taboos, trends
    standards.md                        ← quality criteria for posts
  agents/
    copywriter/
      skill.md                          ← post writing prompt (VK-first)
    designer/
      skill.md                          ← HTML/CSS layout + image prompt
    content-planner/
      skill.md                          ← content plan from strategy
    orchestrator/
      skill.md                          ← dispatch, quality control
    analytics/
      skill.md                          ← metrics → strategy updates
  tools/
    render-html.js                      ← HTML → PNG (Puppeteer)
    render-html.test.js                 ← test: renders sample HTML to PNG
    sync.sh                             ← girl's one-command git sync
  projects/
    _template/                          ← copy this for each new client
      context.md
      strategy.md
      content-plan.md
      orchestrator.md
      posts/drafts/.gitkeep
      posts/inbox/.gitkeep
      posts/approved/.gitkeep
      posts/published/.gitkeep
      feedback/.gitkeep
      assets/images/.gitkeep
      analytics/.gitkeep
  girl-workspace/
    README.md                           ← girl's instruction
    skills/
      review-post.md
      apply-feedback.md
      export-post.md
  docs/
    dev-guide.md                        ← how to build and train agents
```

---

## PHASE 0 — Foundation

### Task 1: GitHub repo + branch setup

**Files:**
- Create: `smm-system/.gitignore`

- [ ] **Step 1: Init repo**

```bash
cd /Users/maxkaymaks/CLAUDE/smm-system
git init
git checkout -b main
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.DS_Store
*.log
.env
```

- [ ] **Step 3: Create girl branch**

```bash
git checkout -b girl
git checkout main
```

- [ ] **Step 4: First commit**

```bash
git add .gitignore
git commit -m "chore: init smm-system repo"
```

Expected: `[main (root-commit) xxxxxxx] chore: init smm-system repo`

---

### Task 2: Node.js + Puppeteer setup

**Files:**
- Create: `smm-system/package.json`

- [ ] **Step 1: Init package.json**

```bash
cd /Users/maxkaymaks/CLAUDE/smm-system
npm init -y
```

- [ ] **Step 2: Install Puppeteer**

```bash
npm install puppeteer
```

Expected: `added NNN packages` — no errors.

- [ ] **Step 3: Verify Chromium downloaded**

```bash
node -e "const p = require('puppeteer'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 4: Add node_modules to .gitignore (already there), commit package.json**

```bash
git add package.json package-lock.json
git commit -m "chore: add puppeteer dependency"
```

---

### Task 3: HTML → PNG render tool

**Files:**
- Create: `smm-system/tools/render-html.js`
- Create: `smm-system/tools/render-html.test.js`

- [ ] **Step 1: Write render-html.js**

```javascript
// tools/render-html.js
// Usage: node render-html.js <input.html> <output.png> [width]
// Default width: 1080px (VK post standard)

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function renderHtml(htmlPath, outputPath, width = 1080) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const absoluteHtmlPath = path.resolve(htmlPath);
  await page.goto(`file://${absoluteHtmlPath}`, { waitUntil: 'networkidle0' });

  // Get actual content height
  const height = await page.evaluate(() => document.body.scrollHeight);

  await page.setViewport({
    width: Number(width),
    height: height,
    deviceScaleFactor: 2, // 2x resolution — crisp on retina
  });

  await page.screenshot({
    path: outputPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: Number(width), height: height },
  });

  await browser.close();
  console.log(`Rendered: ${outputPath} (${width}x${height}px @2x)`);
}

const [, , htmlFile, pngFile, widthArg] = process.argv;

if (!htmlFile || !pngFile) {
  console.error('Usage: node render-html.js <input.html> <output.png> [width=1080]');
  process.exit(1);
}

renderHtml(htmlFile, pngFile, widthArg || 1080).catch((err) => {
  console.error('Render failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Write test HTML sample**

```bash
cat > /tmp/test-post.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin: 0; background: #1a1a2e; font-family: Arial, sans-serif; }
  .post { width: 1080px; padding: 60px; box-sizing: border-box; }
  h1 { color: #e0e0ff; font-size: 48px; margin-bottom: 24px; }
  p { color: #aaaacc; font-size: 28px; line-height: 1.6; }
</style>
</head>
<body>
  <div class="post">
    <h1>Тестовый пост</h1>
    <p>Проверка рендера HTML → PNG без потери качества.</p>
  </div>
</body>
</html>
EOF
```

- [ ] **Step 3: Write test file**

```javascript
// tools/render-html.test.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT = '/tmp/test-post-output.png';

// Clean up before test
if (fs.existsSync(OUTPUT)) fs.unlinkSync(OUTPUT);

// Run render
execSync(`node ${path.join(__dirname, 'render-html.js')} /tmp/test-post.html ${OUTPUT}`);

// Assert file exists and has content
if (!fs.existsSync(OUTPUT)) {
  console.error('FAIL: output PNG not created');
  process.exit(1);
}

const size = fs.statSync(OUTPUT).size;
if (size < 1000) {
  console.error(`FAIL: PNG too small (${size} bytes) — likely empty`);
  process.exit(1);
}

console.log(`PASS: PNG created at ${OUTPUT} (${size} bytes)`);
```

- [ ] **Step 4: Run test — expect FAIL (file not yet created)**

```bash
cd /Users/maxkaymaks/CLAUDE/smm-system
node tools/render-html.test.js
```

Expected: `FAIL: output PNG not created` (render-html.js doesn't exist yet — verifying test logic works)

- [ ] **Step 5: Run actual render**

```bash
node tools/render-html.js /tmp/test-post.html /tmp/test-post-output.png
```

Expected: `Rendered: /tmp/test-post-output.png (1080xNNNpx @2x)`

- [ ] **Step 6: Run test — expect PASS**

```bash
node tools/render-html.test.js
```

Expected: `PASS: PNG created at /tmp/test-post-output.png (NNNNN bytes)`

- [ ] **Step 7: Open PNG and visually verify — fonts sharp, layout correct**

```bash
open /tmp/test-post-output.png
```

- [ ] **Step 8: Commit**

```bash
git add tools/
git commit -m "feat: add HTML→PNG render tool (Puppeteer, 2x resolution)"
```

---

### Task 4: Global rules and standards

**Files:**
- Create: `smm-system/global/rules.md`
- Create: `smm-system/global/standards.md`

- [ ] **Step 1: Create global/ directory and rules.md**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/global
```

```markdown
<!-- global/rules.md -->
# Глобальные правила SMM-системы

> Этот файл загружается всеми агентами для всех проектов.
> Обновляй здесь — изменения применяются автоматически.

## Форматирование постов (ВК-приоритет)

- Длина текста: 300–900 символов для охватного поста, 900–2200 для экспертного
- Абзацы: 2–4 строки максимум, воздух между абзацами обязателен
- Эмодзи: 1–3 штуки на пост, только по смыслу, не для декора
- CTA (призыв к действию) — в каждом посте, последний абзац
- Хэштеги ВК: 3–5, тематические, не спамные

## Дизайн постов

- Размер холста: 1080×1080px (квадрат) или 1080×1350px (портрет)
- Отступы от краёв: минимум 60px
- Текст на изображении: максимум 20% площади
- Шрифты: только системные или Google Fonts (подключать через @import в HTML)
- Фон: не чисто белый (скучно) — используй #f5f5f5 или цветовую схему клиента

## Общие табу

- Не использовать слова: «уникальный», «лучший», «качественный» без доказательств
- Не писать капслоком целые предложения
- Не делать посты-списки больше 7 пунктов
- Не публиковать посты без CTA
- Не копировать тексты конкурентов

## Актуальные тренды (обновлять ежемесячно)

- Короткие видео с субтитрами > статичные картинки по охвату
- Личная история владельца > корпоративный тон
- Экспертный контент с конкретными цифрами > общие советы
- Сторис каждый день > редкие посты в ленту

## Язык и тон

- Русский язык, без канцелярита
- Обращение на «вы» если не оговорено иное в контексте клиента
- Без стоп-слов: «просто», «буквально», «на самом деле», «конечно»
```

- [ ] **Step 2: Create standards.md**

```markdown
<!-- global/standards.md -->
# Критерии качества поста

> Используется главным агентом для проверки перед отправкой в inbox.

## Чеклист текста (все пункты должны быть ДА)

- [ ] Есть чёткий первый абзац — крючок, читатель понимает о чём пост
- [ ] Длина соответствует типу поста (rules.md)
- [ ] Нет слов из списка табу
- [ ] Есть CTA в последнем абзаце
- [ ] Соответствует тону и голосу клиента из context.md
- [ ] Нет орфографических ошибок

## Чеклист дизайна (все пункты должны быть ДА)

- [ ] Размер холста корректный (1080px ширина)
- [ ] Читаемость текста на изображении (контраст достаточный)
- [ ] Логотип или имя бренда присутствует (если требуется в context.md)
- [ ] Цвета соответствуют бренд-буку клиента
- [ ] HTML рендерится без ошибок в PNG

## Оценка поста (1–5)

5 — отличный пост, публикуй
4 — хороший, мелкие правки
3 — нужна доработка, вернуть агенту
2 — слабый, переписать
1 — не соответствует клиенту, пересмотреть стратегию
```

- [ ] **Step 3: Commit**

```bash
git add global/
git commit -m "feat: add global rules and quality standards"
```

---

### Task 5: Project template

**Files:**
- Create: `smm-system/projects/_template/` (весь каталог)

- [ ] **Step 1: Create template structure**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/drafts
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/inbox
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/approved
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/published
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/feedback
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/assets/images
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/analytics
touch /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/drafts/.gitkeep
touch /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/inbox/.gitkeep
touch /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/approved/.gitkeep
touch /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/posts/published/.gitkeep
touch /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/feedback/.gitkeep
touch /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/assets/images/.gitkeep
touch /Users/maxkaymaks/CLAUDE/smm-system/projects/_template/analytics/.gitkeep
```

- [ ] **Step 2: Create context.md template**

```markdown
<!-- projects/_template/context.md -->
# Контекст клиента: [ИМЯ КЛИЕНТА]

## Основное

- **Название:** 
- **Сфера:** 
- **Сайт:** 
- **Соцсети:** VK: | TG: | MAX:

## Бренд и голос

- **Тон:** (например: дружелюбный и экспертный / строгий и профессиональный)
- **Обращение к аудитории:** вы / ты
- **Стоп-слова для этого клиента:** 
- **Обязательные элементы в постах:** (логотип / хэштег / подпись)

## Целевая аудитория

- **Возраст:** 
- **Интересы:** 
- **Боли:** 
- **Желания:** 

## Цвета и стиль

- **Основной цвет:** #
- **Дополнительный цвет:** #
- **Стиль дизайна:** (минимализм / яркий / корпоративный)
- **Шрифт заголовков:** 
- **Шрифт текста:** 

## Что нельзя

- 
- 

## Конкуренты (не упоминать, но знать)

- 
```

- [ ] **Step 3: Create strategy.md template**

```markdown
<!-- projects/_template/strategy.md -->
# Контент-стратегия: [ИМЯ КЛИЕНТА]

## Цели на 3 месяца

- 
- 

## Рубрики (контент-микс)

| Рубрика | Частота | Цель |
|---------|---------|------|
| Экспертный пост | 2x неделю | Доверие |
| Кейс / история | 1x неделю | Продажи |
| За кулисами | 1x неделю | Лояльность |
| Акция / оффер | 2x месяц | Конверсия |

## Форматы

- Текст + картинка: основной
- Видео: по возможности
- Опросы: 1-2 раза в месяц

## KPI

- Охват поста: 
- ER (вовлечённость): 
- Прирост подписчиков/мес: 
```

- [ ] **Step 4: Create content-plan.md template**

```markdown
<!-- projects/_template/content-plan.md -->
# Контент-план: [ИМЯ КЛИЕНТА]
Период: [дата начала] — [дата конца]

| # | Дата | Рубрика | Тема | Статус | Файл |
|---|------|---------|------|--------|------|
| 01 | | | | draft | posts/drafts/post-01.md |
| 02 | | | | | |
```

- [ ] **Step 5: Create orchestrator.md template**

```markdown
<!-- projects/_template/orchestrator.md -->
# Проектный оркестратор: [ИМЯ КЛИЕНТА]

## Инструкция для главного агента

При запуске для этого проекта:

1. Прочитай `context.md` — это контекст клиента
2. Прочитай `strategy.md` — это стратегия
3. Прочитай `content-plan.md` — это текущий план
4. Прочитай `global/rules.md` — это общие правила
5. Прочитай `global/standards.md` — это критерии качества
6. Прочитай `feedback/` — если есть непрочитанный фидбек, обработай сначала его

## Задача на этот запуск

[Оркестратор заполняет при каждом запуске — например: "Написать посты 03 и 04 из контент-плана"]

## Формат ТЗ для исполнителей

При диспатче копирайтера передавай:
- Тему поста и рубрику
- Полный context.md клиента
- Релевантные правила из global/rules.md
- Конкретное задание (тон, CTA, что упомянуть)

При диспатче дизайнера передавай:
- Готовый текст поста
- Цвета и стиль из context.md
- Тип холста (квадрат / портрет)
- Что должно быть на картинке
```

- [ ] **Step 6: Commit template**

```bash
git add projects/
git commit -m "feat: add project template structure"
```

---

## PHASE 1 — Post Machine (приоритет)

### Task 6: Copywriter agent skill

**Files:**
- Create: `smm-system/agents/copywriter/skill.md`

- [ ] **Step 1: Create copywriter skill**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/agents/copywriter
```

```markdown
<!-- agents/copywriter/skill.md -->
# Агент-копирайтер

## Роль

Ты профессиональный SMM-копирайтер. Ты НЕ знаешь ни одного клиента — тебе передают полное ТЗ с контекстом. Твоя задача: написать пост точно по ТЗ.

## Что ты получаешь в ТЗ

- Контекст клиента (бренд, тон, аудитория, табу)
- Глобальные правила (форматирование, стоп-слова)
- Тему и рубрику поста
- Конкретное задание (что упомянуть, какой CTA)

## Как писать пост

### Структура (VK-приоритет)

```
[КРЮЧОК — первые 2 строки, без пустоты]

[ТЕЛО — 2-3 абзаца, каждый по 2-4 строки]

[CTA — последний абзац, конкретное действие]

[ХЭШТЕГИ — 3-5 штук]
```

### Правила (всегда)

1. Первые 2 строки = крючок. Читатель решает читать дальше именно по ним.
2. Абзацы короткие — максимум 4 строки, воздух между ними.
3. CTA конкретный: не «напишите нам», а «напишите нам слово ХОЧУ и мы пришлём прайс».
4. Тон строго по context.md клиента.
5. Ни одного слова из списка табу (в context.md и global/rules.md).
6. Эмодзи: 1-3 штуки, только по смыслу.

## Что ты выдаёшь

Файл `post-NN.md` в следующем формате:

```markdown
# Пост NN — [Рубрика]
Дата: [из контент-плана]
Платформа: VK (основная)

---

[ТЕКСТ ПОСТА]

---

## Адаптации

### Telegram
[Текст с учётом специфики TG — можно чуть длиннее, меньше хэштегов]

### MAX
[Текст — аналогично VK]

---

## Промпт для дизайнера
[Описание: что должно быть на картинке, настроение, цвета, текст на изображении если нужен]
```

## Чего не делать

- Не придумывай факты о клиенте, которых нет в ТЗ
- Не нарушай табу из context.md
- Не пиши пост без CTA
- Не делай первый абзац из представления («Сегодня мы расскажем...»)
```

- [ ] **Step 2: Commit**

```bash
git add agents/copywriter/
git commit -m "feat: add copywriter agent skill"
```

---

### Task 7: Designer agent skill

**Files:**
- Create: `smm-system/agents/designer/skill.md`

- [ ] **Step 1: Create designer skill**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/agents/designer
```

```markdown
<!-- agents/designer/skill.md -->
# Агент-дизайнер

## Роль

Ты SMM-дизайнер. Ты создаёшь HTML/CSS макет поста — он конвертируется в PNG без изменений через Puppeteer. Пиши чистый, точный HTML. Никаких внешних зависимостей кроме Google Fonts.

## Что ты получаешь в ТЗ

- Текст поста (или его часть для визуала)
- Цвета бренда (из context.md клиента)
- Промпт для изображения (от копирайтера)
- Тип холста: квадрат (1080×1080) или портрет (1080×1350)
- Что должно быть на картинке

## Что ты выдаёшь

### Файл 1: `post-NN.html`

Полный HTML-файл. Требования:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  /* Все стили inline в <style> — никаких внешних CSS-файлов */
  /* Google Fonts через @import — единственное исключение */
  
  body {
    margin: 0;
    padding: 0;
    /* Ширина ВСЕГДА 1080px — не трогать */
  }
  
  .post {
    width: 1080px;
    height: 1080px; /* или 1350px для портрета */
    /* отступы минимум 60px */
    /* переполнения нет — overflow: hidden если нужно */
  }
</style>
</head>
<body>
  <!-- Весь контент внутри .post -->
</body>
</html>
```

**Правила HTML:**
- Ширина контейнера: строго 1080px
- Все шрифты: Google Fonts или системные (Arial, Georgia)
- Никаких внешних изображений — только CSS-градиенты, формы, цвета
- Если нужно фото — оставь место с placeholder (#цвет) и укажи в комментарии где вставить
- Текст на изображении: максимум 20% площади, контраст минимум 4.5:1
- overflow: hidden на корневом контейнере — ничего не вылезает

### Файл 2: `post-NN-image-prompt.md`

Промпт для генерации фото (если нужно фото):

```markdown
# Image Prompt — post-NN

## Для Midjourney / Flux / DALL-E

[Промпт на английском, детальный]

## Технические требования
- Размер: 1080x1080px
- Стиль: [фотореализм / иллюстрация / flat design]
- Цветовая гамма: [цвета из бренда]

## Куда вставить в HTML
Файл: post-NN.html
Селектор: .hero-image или background-image на .post
```

## Типовые шаблоны (используй как основу)

### Шаблон: Текстовый пост с акцентом

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; }
  .post {
    width: 1080px;
    height: 1080px;
    background: #ОСНОВНОЙ_ЦВЕТ;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 80px;
    overflow: hidden;
  }
  .tag {
    font-size: 22px;
    font-weight: 600;
    color: #АКЦЕНТ;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 32px;
  }
  .headline {
    font-size: 64px;
    font-weight: 700;
    color: #ТЕКСТ;
    line-height: 1.15;
    margin-bottom: 32px;
  }
  .body {
    font-size: 30px;
    color: #ТЕКСТ_ВТОРИЧНЫЙ;
    line-height: 1.6;
    margin-bottom: 48px;
  }
  .brand {
    font-size: 24px;
    font-weight: 600;
    color: #АКЦЕНТ;
  }
</style>
</head>
<body>
<div class="post">
  <div class="tag">РУБРИКА</div>
  <div class="headline">Заголовок до<br>двух строк</div>
  <div class="body">Короткий подзаголовок или<br>ключевая мысль поста.</div>
  <div class="brand">@бренд</div>
</div>
</body>
</html>
```

## Чего не делать

- Не использовать внешние изображения через `<img src="http...">` — сломает рендер
- Не выходить за 1080px ширину
- Не делать текст меньше 24px (нечитабельно в соцсети)
- Не забывать про overflow: hidden
```

- [ ] **Step 2: Commit**

```bash
git add agents/designer/
git commit -m "feat: add designer agent skill"
```

---

### Task 8: Girl workspace skills

**Files:**
- Create: `smm-system/girl-workspace/skills/review-post.md`
- Create: `smm-system/girl-workspace/skills/apply-feedback.md`
- Create: `smm-system/girl-workspace/skills/export-post.md`

- [ ] **Step 1: Create review-post skill**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/girl-workspace/skills
```

```markdown
<!-- girl-workspace/skills/review-post.md -->
# Скилл: Проверка и редактура поста

## Когда использовать

Когда в `posts/inbox/` появился новый пост от агентов.

## Что делаю

1. Читаю `posts/inbox/post-NN.md` — текст поста
2. Читаю `posts/inbox/post-NN.png` — дизайн
3. Проверяю по чеклисту из `global/standards.md`
4. Если ок — перемещаю в `posts/approved/`
5. Если нужны правки — правлю текст прямо в файле и перемещаю в `posts/approved/`
6. Если серьёзные проблемы — перемещаю в `posts/drafts/` и добавляю комментарий `## Замечания` внизу файла

## Как двигать файлы

```bash
# Одобрить пост
mv posts/inbox/post-01.md posts/approved/
mv posts/inbox/post-01.html posts/approved/
mv posts/inbox/post-01.png posts/approved/

# Вернуть на доработку
mv posts/inbox/post-01.md posts/drafts/
# (html и png тоже)
```

## Что проверять в тексте

- Нет опечаток и ошибок
- Тон соответствует клиенту (читай context.md если не уверена)
- CTA есть и он конкретный
- Пост не слишком длинный / короткий

## Что проверять в дизайне (PNG)

- Текст читается, нет каши
- Цвета соответствуют бренду
- Ничего не обрезано по краям
```

- [ ] **Step 2: Create apply-feedback skill**

```markdown
<!-- girl-workspace/skills/apply-feedback.md -->
# Скилл: Применить фидбек заказчика

## Когда использовать

Заказчик прислал правки — нужно зафиксировать их и применить.

## Шаг 1: Записать фидбек в файл

Создай файл `feedback/fb-NN.md`:

```markdown
# Фидбек NN
Дата: [дата]
Пост: post-NN
Источник: [заказчик / сам заметила]

## Что сказал заказчик

[Дословно или пересказ]

## Что нужно изменить

- [ ] 
- [ ] 

## Статус
- [ ] Передано агенту
- [ ] Исправлено
- [ ] Одобрено
```

## Шаг 2: Применить простые правки самостоятельно

Если правка простая (поменять слово, убрать хэштег, сократить абзац) — правь прямо в `posts/approved/post-NN.md`.

## Шаг 3: Сложные правки — передать агенту

Если правка требует переписать пост или переделать дизайн — скажи мне (Claude) и передай файл `feedback/fb-NN.md`. Я запущу агента.

## После применения правок

Обнови статус в `feedback/fb-NN.md`:
```
- [x] Передано агенту
- [x] Исправлено
```
```

- [ ] **Step 3: Create export-post skill**

```markdown
<!-- girl-workspace/skills/export-post.md -->
# Скилл: Экспорт поста для публикации

## Когда использовать

Пост одобрен и готов к публикации.

## Что взять из `posts/approved/post-NN.md`

- **VK:** основной текст (раздел под `---`)
- **Telegram:** раздел `### Telegram`
- **MAX:** раздел `### MAX`
- **Картинка:** файл `post-NN.png`

## Что делать

1. Открой `post-NN.md` — скопируй нужный текст
2. Возьми `post-NN.png` — это финальная картинка
3. Опубликуй вручную в нужной соцсети
4. После публикации перемести файлы в `posts/published/`:

```bash
mv posts/approved/post-NN.md posts/published/
mv posts/approved/post-NN.html posts/published/
mv posts/approved/post-NN.png posts/published/
```

5. Добавь дату публикации в `content-plan.md` в колонку Статус

## Адаптации для платформ

| Платформа | Текст | Картинка | Хэштеги |
|-----------|-------|----------|---------|
| ВКонтакте | Полный текст поста | post-NN.png | 3-5 тематических |
| Telegram | Раздел Telegram из файла | post-NN.png | 0-2 |
| MAX | Раздел MAX из файла | post-NN.png | 3-5 |
```

- [ ] **Step 4: Commit**

```bash
git add girl-workspace/
git commit -m "feat: add girl workspace skills (review, feedback, export)"
```

---

### Task 9: Girl README (инструкция для девочки)

**Files:**
- Create: `smm-system/girl-workspace/README.md`
- Create: `smm-system/tools/sync.sh`

- [ ] **Step 1: Create sync.sh**

```bash
#!/bin/bash
# sync.sh — синхронизация с GitHub
# Использование: ./tools/sync.sh pull   — получить новые задачи
#               ./tools/sync.sh push   — отправить выполненную работу

ACTION=$1

if [ "$ACTION" = "pull" ]; then
  echo "Получаю новые задачи..."
  git pull origin girl
  echo "Готово. Смотри папку posts/inbox/ в своём проекте."

elif [ "$ACTION" = "push" ]; then
  echo "Отправляю работу..."
  git add posts/ feedback/
  git commit -m "girl: $(date '+%Y-%m-%d') работа выполнена"
  git push origin girl
  echo "Готово. Разработчик увидит изменения."

else
  echo "Использование: ./tools/sync.sh pull | push"
  exit 1
fi
```

```bash
chmod +x /Users/maxkaymaks/CLAUDE/smm-system/tools/sync.sh
```

- [ ] **Step 2: Create girl README**

```markdown
<!-- girl-workspace/README.md -->
# Рабочее место SMM — Инструкция

Привет! Здесь всё что нужно для работы с постами.

---

## Ежедневный ритм

### Утром — получить новые задачи

```bash
./tools/sync.sh pull
```

После этого смотри папку `projects/[клиент]/posts/inbox/` — там новые черновики.

### В течение дня — работа с постами

Используй скиллы в папке `girl-workspace/skills/`:

| Скилл | Когда | Что делает |
|-------|-------|------------|
| `review-post.md` | Новый пост в inbox/ | Проверяю и одобряю или правлю |
| `apply-feedback.md` | Заказчик дал правки | Записываю и применяю фидбек |
| `export-post.md` | Пост одобрен | Готовлю к публикации |

### Вечером — отправить работу

```bash
./tools/sync.sh push
```

---

## Структура проекта клиента

```
projects/[клиент]/
  posts/
    inbox/      ← сюда приходят новые посты от агентов
    approved/   ← одобренные мной
    published/  ← опубликованные
  feedback/     ← фидбек заказчиков
  context.md    ← информация о клиенте (читай если есть вопросы)
```

---

## Файлы поста

Каждый пост = 3 файла:
- `post-01.md` — текст для всех платформ
- `post-01.html` — дизайн (технический файл)
- `post-01.png` — картинка для публикации

---

## Как работать с Claude Code

1. Открой терминал
2. `cd /Users/[тебя]/smm-system/girl-workspace`
3. Напиши Claude что нужно сделать, например:
   - «Проверь пост post-01 в inbox проекта client-a»
   - «Запиши фидбек: заказчик хочет убрать хэштеги»
   - «Подготовь post-02 к публикации в ВК»

---

## Частые вопросы

**Пост плохой — что делать?**
Скажи Claude: «Верни post-01 на доработку, замечания: [что не так]»

**Заказчик хочет правки — что делать?**
Используй скилл `apply-feedback.md` или скажи Claude: «Запиши фидбек по post-01: [текст правки]»

**Непонятно как звучит бренд клиента?**
Открой `projects/[клиент]/context.md`
```

- [ ] **Step 3: Commit**

```bash
git add girl-workspace/README.md tools/sync.sh
git commit -m "feat: add girl README and sync script"
```

---

## PHASE 2 — Orchestration

### Task 10: Orchestrator agent skill

**Files:**
- Create: `smm-system/agents/orchestrator/skill.md`

- [ ] **Step 1: Create orchestrator skill**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/agents/orchestrator
```

```markdown
<!-- agents/orchestrator/skill.md -->
# Главный агент — Оркестратор

## Роль

Ты главный агент SMM-системы. Ты управляешь командой, контролируешь качество, читаешь фидбек и диспатчишь исполнителей. Ты не пишешь посты сам — ты ставишь ТЗ.

## При каждом запуске

1. Определи проект (передаётся в запросе или из `projects/` по slug)
2. Прочитай `projects/{client}/orchestrator.md` — задача на запуск
3. Прочитай `projects/{client}/feedback/` — есть ли непрочитанный фидбек? Обработай его первым.
4. Прочитай `projects/{client}/content-plan.md` — что следующее в очереди?
5. Диспатч агентов

## Как диспатчить агентов

Используй Agent tool. Передавай ПОЛНЫЙ контекст — агент ничего не знает о клиенте сам:

```
Агент: copywriter
ТЗ:
  - Контекст клиента: [полное содержимое context.md]
  - Глобальные правила: [полное содержимое global/rules.md]
  - Задача: Написать пост №NN
  - Рубрика: [из контент-плана]
  - Тема: [тема]
  - CTA: [конкретный призыв]
  - Особые требования: [если есть]
  - Сохранить в: projects/{client}/posts/drafts/post-NN.md
```

## Контроль качества

После получения результата от агента:
1. Прочитай результат
2. Проверь по чеклисту из `global/standards.md`
3. Оценка 4-5: пост готов → перемести в `posts/inbox/`
4. Оценка 1-3: верни агенту с конкретными замечаниями

## Обработка фидбека

Файл `feedback/fb-NN.md` содержит правки заказчика:
1. Прочитай что изменить
2. Диспатч копирайтера / дизайнера с ТЗ на правку
3. Отметь в fb-NN.md: `- [x] Передано агенту`
4. После исправления обнови: `- [x] Исправлено`

## Что не делать

- Не пиши посты сам (ухудшает качество)
- Не пропускай контроль качества
- Не игнорируй непрочитанный фидбек
```

- [ ] **Step 2: Commit**

```bash
git add agents/orchestrator/
git commit -m "feat: add orchestrator agent skill"
```

---

### Task 11: Content planner agent skill

**Files:**
- Create: `smm-system/agents/content-planner/skill.md`

- [ ] **Step 1: Create content-planner skill**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/agents/content-planner
```

```markdown
<!-- agents/content-planner/skill.md -->
# Агент контент-планирования

## Роль

Ты создаёшь контент-план на основе стратегии клиента. Ты stateless — получаешь всё нужное в ТЗ.

## Что получаешь в ТЗ

- Стратегия клиента (`strategy.md`)
- Контекст клиента (`context.md`)
- Период: неделя или месяц
- Текущая дата
- Уже опубликованные темы (чтобы не повторяться)

## Что выдаёшь

Обновлённый `content-plan.md` в формате:

```markdown
# Контент-план: [клиент]
Период: [дата начала] — [дата конца]
Создан: [дата]

| # | Дата | День | Рубрика | Тема | Формат | Статус |
|---|------|------|---------|------|--------|--------|
| 01 | 21.04 | Пн | Экспертный | [тема] | Текст+картинка | planned |
| 02 | 23.04 | Ср | Кейс | [тема] | Текст+картинка | planned |
| 03 | 25.04 | Пт | За кулисами | [тема] | Текст+картинка | planned |
```

## Правила планирования

- Чередуй рубрики — не ставь одинаковые подряд
- Привязывай к актуальным событиям/датам если уместно
- Понедельник/среда/пятница — стандартный ритм для малого бизнеса
- Минимум 1 продающий пост в неделю
- Темы должны отвечать на реальные вопросы ЦА из context.md

## Чего не делать

- Не повторять темы из предыдущих планов
- Не ставить больше 1 акционного поста подряд
- Не планировать посты на воскресенье (низкий охват для большинства ниш)
```

- [ ] **Step 2: Commit**

```bash
git add agents/content-planner/
git commit -m "feat: add content-planner agent skill"
```

---

### Task 12: Scheduled task для оркестратора

**Files:**
- Modify: Claude Code settings (scheduled tasks)

- [ ] **Step 1: Создать scheduled trigger через superpowers:schedule**

Используй скилл `schedule` для создания recurring task:
```
Задача: Запускать главный оркестратор каждый понедельник в 9:00
Команда: Прочитать projects/ и создать посты на неделю для активных клиентов
```

- [ ] **Step 2: Добавить в документацию**

Записать в `docs/dev-guide.md` раздел «Расписание» — какие задачи запускаются автоматически.

---

## PHASE 3 — Analytics & Self-improvement

### Task 13: Analytics agent skill

**Files:**
- Create: `smm-system/agents/analytics/skill.md`

- [ ] **Step 1: Create analytics skill**

```bash
mkdir -p /Users/maxkaymaks/CLAUDE/smm-system/agents/analytics
```

```markdown
<!-- agents/analytics/skill.md -->
# Агент аналитики и самообучения

## Роль

Ты анализируешь результаты публикаций и обновляешь стратегию и правила. Ты замыкаешь петлю обратной связи системы.

## Что получаешь в ТЗ

- Папка `projects/{client}/analytics/` — файлы с метриками
- Папка `projects/{client}/posts/published/` — опубликованные посты
- Текущие `global/rules.md` и `projects/{client}/strategy.md`

## Формат файла метрик

Девочка (или разработчик) создаёт `analytics/metrics-YYYY-MM.md`:

```markdown
# Метрики: [клиент] [месяц]

| Пост | Дата | Охват | Лайки | Репосты | Комменты | ER% |
|------|------|-------|-------|---------|----------|-----|
| post-01 | | | | | | |
```

## Что анализировать

1. Какие рубрики дают лучший ER?
2. Какой тон (экспертный / личный / юморной) работает лучше?
3. Какое время публикации даёт лучший охват?
4. Какие темы провалились?

## Что выдаёшь

### Файл 1: `analytics/report-YYYY-MM.md`

```markdown
# Аналитика [клиент] [месяц]

## Топ-3 поста
[посты с лучшим ER + что в них сработало]

## Аутсайдеры
[посты с низким ER + гипотеза почему]

## Выводы
[конкретные паттерны]

## Рекомендации
[что изменить в стратегии]
```

### Файл 2: Обновления в `global/rules.md`

Предложи конкретные правки в `global/rules.md` если паттерн повторяется у нескольких клиентов (например: «посты с вопросом в заголовке дают +40% ER» → добавить в правила).

### Файл 3: Обновления в `strategy.md` клиента

Предложи правки в стратегию клиента на основе данных.

## Самообучение системы

Если за 3 месяца определённый тип поста стабильно даёт ER выше среднего:
- Добавь паттерн в `global/rules.md` раздел «Проверенные форматы»
- Обнови шаблон в `agents/copywriter/skill.md` если нужно

Правки в глобальные файлы предлагаются разработчику на проверку — не применяются автоматически.
```

- [ ] **Step 2: Commit**

```bash
git add agents/analytics/
git commit -m "feat: add analytics and self-improvement agent skill"
```

---

### Task 14: Dev guide (инструкция для разработчика)

**Files:**
- Create: `smm-system/docs/dev-guide.md`

- [ ] **Step 1: Create dev-guide.md**

```markdown
<!-- docs/dev-guide.md -->
# Dev Guide — Как разрабатывать и обучать агентов

## Принципы системы

1. **Агенты stateless** — каждый получает полный контекст в ТЗ, ничего не помнит между запусками
2. **Глобальные правила** — одно изменение в `global/rules.md` влияет на всех
3. **Проектный контекст** — специфика клиента только в `projects/{client}/context.md`
4. **Итерация** — улучшай агентов на основе реальных результатов

---

## Как создать нового клиента

```bash
cp -r projects/_template projects/{client-slug}
```

Заполни:
1. `projects/{client}/context.md` — всё о клиенте
2. `projects/{client}/strategy.md` — контент-стратегия
3. `projects/{client}/orchestrator.md` — задача для первого запуска

---

## Как запустить агента вручную

В своём Claude Code сессии:

```
Запусти агента copywriter для проекта {client}:
- Прочитай: global/rules.md, projects/{client}/context.md
- Задача: написать пост на тему [X] для рубрики [Y]
- Сохранить в: projects/{client}/posts/drafts/post-NN.md
```

---

## Как улучшить агента (обучение)

### Шаг 1: Собери примеры

Найди 3-5 постов, которые сработали хорошо (ER выше среднего). Скопируй их в `agents/copywriter/examples/good/`.

### Шаг 2: Найди паттерн

Что общего в хороших постах? Структура? Тон? Длина? Тип CTA?

### Шаг 3: Обнови skill.md

Добавь паттерн как правило в соответствующий `agents/{role}/skill.md`.
Раздел: `## Проверенные паттерны (из реальных данных)`.

### Шаг 4: Добавь Few-shot примеры

В `agents/{role}/skill.md` добавь раздел `## Примеры отличных постов` с 2-3 реальными примерами.

### Шаг 5: Протестируй

Запусти агента с новым скиллом, сравни результат со старым.

---

## Как обновить тренды (ежемесячно)

Открой `global/rules.md`, раздел `## Актуальные тренды`.
Обнови на основе:
- Результатов аналитики клиентов
- Актуальных наблюдений за соцсетями
- Новых форматов на платформах

---

## Структура веток GitHub

```
main    ← разработка, агенты, глобальные правила
girl    ← только posts/ и feedback/
```

**Флоу работы:**
```
main → (агенты создают черновики) → push → girl branch
girl branch → (девочка работает) → push → ты мержишь → main
```

---

## Добавление нового агента

1. Создай папку `agents/{name}/`
2. Напиши `agents/{name}/skill.md` по шаблону (роль, что получает, что выдаёт, правила)
3. Добавь в `agents/orchestrator/skill.md` раздел как диспатчить нового агента
4. Протестируй вручную с реальным ТЗ
5. Commit: `feat: add {name} agent skill`

---

## Качество: как проверять агентов

Используй `global/standards.md` — это чеклист для любого поста.

Для системного улучшения раз в месяц:
1. Запусти analytics агента
2. Прочитай `analytics/report-YYYY-MM.md`
3. Внеси изменения в агентов по выводам
```

- [ ] **Step 2: Commit**

```bash
git add docs/dev-guide.md
git commit -m "docs: add developer guide for building and training agents"
```

---

### Task 15: Push branches to GitHub

- [ ] **Step 1: Создать репозиторий на GitHub**

Зайди на github.com → New repository → `smm-system` → Private → Create

- [ ] **Step 2: Подключить remote и запушить**

```bash
cd /Users/maxkaymaks/CLAUDE/smm-system
git remote add origin https://github.com/[твой-username]/smm-system.git
git push -u origin main
```

- [ ] **Step 3: Создать и запушить girl ветку**

```bash
git checkout girl
git merge main --no-edit
git push -u origin girl
git checkout main
```

- [ ] **Step 4: Проверить на GitHub**

Открой репо — должны быть ветки `main` и `girl`, все файлы на месте.

---

## Self-Review

После написания этого плана — сверка со спеком:

- [x] Phase 0: Foundation — Tasks 1-5 покрывают GitHub, Puppeteer, global/, project template
- [x] Phase 1: Post Machine — Tasks 6-9 покрывают copywriter, designer, girl skills, README
- [x] Phase 2: Orchestration — Tasks 10-12 покрывают orchestrator, content-planner, scheduled
- [x] Phase 3: Analytics — Tasks 13-14 покрывают analytics agent, dev guide
- [x] GitHub workflow — Task 15
- [x] HTML→PNG — Task 3 (render-html.js с Puppeteer, 2x resolution, тест)
- [x] Brief agent — пропущен (skip per spec)
- [x] Girl instructions — Task 9 (README + sync.sh)
- [x] Dev guide — Task 14

Нет противоречий, нет TBD, все пути абсолютные.
```
