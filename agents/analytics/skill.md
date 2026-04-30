# Analytics Agent — Skill

## Роль

Агент аналитики решает две задачи:
1. **Конкурентный анализ** — парсинг аккаунтов по запросу бриф-агента и специалиста
2. **Отчётность** — анализ метрик проекта, выводы, рекомендации для стратегии

---

## Инструменты

### Apify — единственный инструмент парсинга

Все платформы (Instagram, VK, TikTok, Telegram, YouTube) — через Apify.

**Конфигурация:**
- Токен: `.env` → `APIFY_TOKEN`
- User ID: `.env` → `APIFY_USER_ID`
- Скрипт: `tools/apify/scraper.py`
- venv: `tools/apify/.venv`

**Запуск парсинга:**
```bash
cd smm-system
tools/apify/.venv/bin/python3 tools/apify/scraper.py \
  --platform instagram \
  --handle @username \
  --limit 50
```

Платформы: `instagram`, `tiktok`, `vk`. Telegram — через актор вручную (см. ниже).

---

## Apify API — справочник

### Аутентификация
```
Authorization: Bearer {APIFY_TOKEN}
Content-Type: application/json
```

### Запуск актора
```
POST https://api.apify.com/v2/acts/{actorId}/runs
Body: JSON (input актора)
Params: ?waitForFinish=300  ← ждёт до 5 минут, возвращает готовый run
```

**Ключевые поля ответа:**
| Поле | Что это |
|------|---------|
| `data.id` | ID запуска |
| `data.status` | Статус: READY / RUNNING / SUCCEEDED / FAILED / ABORTED / TIMED-OUT |
| `data.defaultDatasetId` | ID датасета с результатами |
| `data.defaultKeyValueStoreId` | KV-хранилище (OUTPUT, INPUT) |

### Статус запуска (polling)
```
GET https://api.apify.com/v2/acts/{actorId}/runs/{runId}
→ data.status
```

### Получить результаты из датасета
```
GET https://api.apify.com/v2/datasets/{datasetId}/items
Params: format=json&clean=true&limit=1000&offset=0
```
Пагинация: если `count < limit` — это последняя страница.

### Получить OUTPUT из KV-хранилища
```
GET https://api.apify.com/v2/key-value-stores/{storeId}/records/OUTPUT
```

### Лимиты
- 250 000 запросов/мин (глобально)
- 60 запросов/сек (на ресурс)
- При 429 → exponential backoff от 500 мс

---

## Инструменты по платформам (протестировано)

### Instagram — `eO62VlcRQs1OfFwHW` (Fast Instagram Profile Reels Scraper)
```python
payload = {
    'instagramUsernames': ['username'],
    'maxReels': 10,
}
```
**Поля вывода:** `taken_at`, `play_count`, `view_count`, `like_count`, `comment_count`,
`video_url` (прямой .mp4), `image` (превью), `caption`, `hashtags`,
`clips_music_attribution_info` (artist_name, song_name, uses_original_audio),
`video_duration`, `reel_url`, `shortcode`

Скачать превью:
```python
requests.get(image_url, headers={'Referer': 'https://www.instagram.com/', 'User-Agent': '...'})
```

---

### Telegram — два актора (выбирать по задаче)

#### ✅ Текстовый анализ / метрики — `automation-lab/telegram-scraper` (ДЕШЁВЫЙ)
**Цена:** $0.005 старт + $0.002 канал + **$0.001/сообщение** → 50 сообщений ≈ $0.06

```python
payload = {
    'channels': ['channelname'],   # без @, без https://
    'maxMessages': 50,
    'includeChannelInfo': True,
}
```
**Поля вывода:** `messageId`, `channelUsername`, `channelTitle`, `text`, `date` (ISO),
`views` (integer), `viewsRaw` ("5.29M"), `mediaType`, `videoUrl`, `videoDuration`,
`reactions` (массив: emoji + count), `isEdited`, `isForwarded`, `url`, `scrapedAt`

Ограничение: только публичные каналы (t.me/s/channel). До 5000 сообщений/запуск.

---

#### Визуальный анализ (медиа, CDN-ссылки) — `GEHKCq8O4orlPjLFf` (ДОРОГОЙ, ~$1-2/запуск)
Использовать **только** когда нужно скачать фото/видео для анализа через fal.ai.

```python
payload = {
    'profiles': ['https://t.me/channelname'],
    'messagesLimit': 50,
}
```
**Поля вывода:** `message.fulldate`, `message.views`, `message.description`,
`message.image` (CSS со встроенным CDN URL — извлекать через regex),
`message.video` (прямой CDN URL `.mp4?token=...`), `message.link`

Извлечение URL из CSS:
```python
import re
urls = re.findall(r"url\('(https?://[^']+)'\)", css_string)
```

---

### VK — прямой VK API (не Apify)
```python
requests.get('https://api.vk.com/method/wall.get', params={
    'domain': 'group_name',
    'count': 50,
    'v': '5.131',
    'access_token': VK_SERVICE_TOKEN,   # .env → VK_SERVICE_TOKEN
    'extended': 1,
})
```
**Поля вывода:** `text`, `date` (unix), `likes.count`, `views.count`, `reposts.count`,
`attachments[].type` (photo/video/doc), фото → `attachments[].photo.sizes[-1].url`,
видео → `https://vk.com/video{owner_id}_{id}`

---

### TikTok — `clockworks/tiktok-scraper`
```python
payload = {
    'profiles': ['https://www.tiktok.com/@username'],
    'profileScrapeSections': ['videos'],
    'resultsPerPage': 20,
}
```
**Поля вывода:** `playCount`, `diggCount` (лайки), `commentCount`, `shareCount`,
`collectCount` (сохранения), `desc`, `createTime`, `video.playAddr`

---

## Анализ видео — fal.ai

Для разбора видео по кадрам (раскадровка, текст на экране, нарратив):

**Модель:** `openrouter/router/video` + `google/gemini-2.0-flash-001`
**Ключ:** `~/.claude/.env.fal` → `FAL_KEY`

```js
import { fal } from "@fal-ai/client";
import fs from "fs";

fal.config({ credentials: process.env.FAL_KEY });

// 1. Загрузить видео в fal storage
const buf = fs.readFileSync("/path/to/video.mp4");
const videoUrl = await fal.storage.upload(
  new Blob([buf], { type: "video/mp4" }),
  { fileName: "video.mp4" }
);

// 2. Анализ
const result = await fal.subscribe("openrouter/router/video", {
  input: {
    model: "google/gemini-2.0-flash-001",
    video_url: videoUrl,
    prompt: `Подробно проанализируй видео. Дай раскадровку:
1. Сколько сцен/монтажных склеек
2. Для каждой сцены: что на экране, текст/субтитры, движение камеры, освещение
3. Визуальный стиль: цветокоррекция, атмосфера, эстетика
4. Текст на экране — процитируй точно
5. Действия/эмоции людей
6. Общий нарратив и посыл`
  },
  logs: true,
});

console.log(result.data.output); // текстовый анализ
```

Скачать видео с Instagram перед загрузкой:
```python
resp = requests.get(video_url, headers={
    'User-Agent': 'Mozilla/5.0...',
    'Referer': 'https://www.instagram.com/',
})
open('/tmp/reel.mp4', 'wb').write(resp.content)
```

---

## Нормализованный формат данных

Все платформы → единая структура (выдаёт `scraper.py`):

```json
{
  "platform": "instagram|tiktok|vk|telegram",
  "id": "...",
  "url": "https://...",
  "type": "photo|video|text|carousel|...",
  "timestamp": "2026-04-21T10:00:00Z",
  "likes": 0,
  "comments": 0,
  "views": 0,
  "shares": 0,
  "caption": "текст поста",
  "hashtags": ["tag1", "tag2"],
  "owner": "username"
}
```

---

## Задача 1: Конкурентный анализ

### Триггер
Запрос от бриф-агента формата:
```
Агент аналитики, нужен анализ для проекта {ProjectID}.
Ниша: {ниша}.
Аккаунты для парсинга: {список}.
Нужно: визуальный стиль постов, форматы контента, реакция аудитории, частота постинга.
Сохрани результат в projects/{ProjectID}/analytics/competitors.md
```

### Процесс

1. Определи платформу каждого аккаунта (Instagram / VK / TikTok / Telegram)
2. Запарси последние 30–50 постов через `tools/apify/scraper.py`
3. Для каждого аккаунта зафиксируй:
   - Частота постинга (постов/неделю)
   - Форматы: фото / видео / карусели / reels / текст — доли
   - Визуальный стиль: цвета, шрифты, типографика, наличие брендинга
   - Темы и рубрики: о чём пишут, что повторяется
   - Реакция аудитории: лайки, репосты, комменты, ER (если доступно)
   - Топ-3 поста по реакции
4. Общие выводы по нише: что работает у всех, где пустая ниша

### Формат `competitors.md`

```markdown
# Анализ конкурентов: {ProjectID}
Дата: {дата}
Ниша: {ниша}

---

## {Аккаунт} — {платформа}

- **Частота:** N постов/неделю
- **Форматы:** 60% фото, 30% reels, 10% карусели
- **Визуал:** [описание стиля]
- **Темы:** [список рубрик]
- **ER:** ~N%
- **Топ-посты:** [ссылки или описание]
- **Вывод:** [что работает]

---

## Общие выводы по нише

- Что делают все: [паттерны]
- Что не делает никто: [пустые ниши]
- Рекомендации для {ProjectID}: [конкретно]
```

---

## Задача 2: Отчёты по проекту

*(Детальная реализация — в разработке)*

### Триггер
Запрос специалиста: "Сделай отчёт за {месяц} по проекту {ProjectID}"

### Источники данных
- `projects/{ProjectID}/analytics/metrics-YYYY-MM.md` — метрики
- `projects/{ProjectID}/posts/published/` — опубликованные посты
- `projects/{ProjectID}/context.md` — цели и KPI

### Формат `analytics/report-YYYY-MM.md`

```markdown
# Отчёт: {ProjectID} — {месяц год}

## Сводка
Постов: N | Средний охват: NNN | Средний ER: N.N%

## Топ-3 по ER
1. [пост] — ER N.N% — [гипотеза]

## Аутсайдеры
1. [пост] — ER N.N% — [гипотеза]

## Паттерны
[Выводы с цифрами]

## Рекомендации
[Что изменить в стратегии]
```

---

## Правила изоляции

- Работай только с указанным `projects/{ProjectID}/`
- Сохраняй результаты только в `projects/{ProjectID}/analytics/`
- Глобальные файлы не редактируй — только предлагай правки специалисту
