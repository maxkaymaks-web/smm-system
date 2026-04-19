---
name: fal-ai
description: Генерирует изображения, видео, аудио через fal.ai API. Основная модель для изображений — nano-banana-2. Также Kling, Minimax, Runway для видео, ElevenLabs для TTS. Вызывай когда нужна генерация изображений, видео или аудио через fal.ai, или когда упоминается FAL_KEY, fal.run, nano-banana.
---

# fal.ai — генерация через API

## Конфигурация

**API-ключ:** `~/.claude/.env.fal` → `FAL_KEY=...` (также прописан в `~/.claude/settings.json`)

**Клиент (Node.js):**
```bash
npm install @fal-ai/client
```

**Правильный импорт:**
```js
import { fal } from "@fal-ai/client";  // именованный, не default
fal.config({ credentials: process.env.FAL_KEY });
```

**Важно:** `fal.run()` предпочтительнее `fal.subscribe()` — queue endpoint (`queue.fal.run`) может таймаутиться. Для видео (долгие задачи) использовать `fal.subscribe()`.

---

## Основная модель для изображений: nano-banana-2

**Model ID:** `fal-ai/nano-banana-2`

### Параметры

| Параметр | Тип | По умолч. | Описание |
|----------|-----|-----------|---------|
| `prompt` | string | — | **Обязательный.** Текстовый промпт |
| `num_images` | integer | 1 | Количество изображений |
| `seed` | integer | — | Сид для воспроизводимости |
| `aspect_ratio` | enum | `auto` | Соотношение сторон: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9`, `4:1` и др. |
| `resolution` | enum | `1K` | Разрешение: `0.5K`, `1K`, `2K`, `4K` |
| `output_format` | enum | `png` | Формат: `jpeg`, `png`, `webp` |
| `safety_tolerance` | enum | `4` | Строгость 1–6 (только через API) |
| `thinking_level` | enum | — | Глубина обдумывания: `minimal`, `high` |
| `enable_web_search` | boolean | — | Разрешить поиск в интернете для актуальных данных |
| `limit_generations` | boolean | `true` | Ограничить до 1 генерации на промпт |
| `sync_mode` | boolean | — | Вернуть как data URI вместо URL |

### Вывод

```json
{
  "images": [{ "url": "...", "file_name": "...", "content_type": "image/png", "width": 1024, "height": 1024 }],
  "description": "Описание сгенерированного изображения"
}
```

### Пример — Node.js

```js
import { fal } from "@fal-ai/client";
import fs from "fs";
import https from "https";

fal.config({ credentials: process.env.FAL_KEY });

async function generateImage(prompt, options = {}) {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: {
      prompt,
      aspect_ratio: options.aspect_ratio ?? "1:1",
      resolution: options.resolution ?? "1K",
      output_format: options.output_format ?? "jpeg",
      num_images: options.num_images ?? 1,
      ...options,
    },
  });
  return result.data;
}

// Использование
const data = await generateImage(
  "cinematic photo of a red fox on snowy hill at golden hour",
  { aspect_ratio: "16:9", resolution: "2K" }
);
console.log(data.images[0].url);
console.log(data.description);
```

### Пример — скачать результат

```js
async function downloadFile(url, outputPath) {
  fs.mkdirSync(require("path").dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, r => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(outputPath); });
    }).on("error", reject);
  });
}

await downloadFile(data.images[0].url, "./output/image.jpg");
```

---

## Другие модели

### Изображения (альтернативы)

| Model ID | Когда использовать |
|----------|-------------------|
| `fal-ai/flux/schnell` | Ультра-быстро, черновики (4 steps) |
| `fal-ai/flux/dev` | Баланс качество/скорость |
| `fal-ai/flux-pro/v1.1-ultra` | Фото-реализм, высокое разрешение |
| `fal-ai/ideogram/v2` | Текст на изображении |
| `fal-ai/recraft-v3` | Векторный/дизайн стиль |

### Видео

| Model ID | Тип | Когда использовать |
|----------|-----|-------------------|
| `fal-ai/kling-video/v2.1/standard/text-to-video` | text→video | Кинематографичное видео |
| `fal-ai/kling-video/v2.1/standard/image-to-video` | img→video | Оживить изображение |
| `fal-ai/minimax/video-01` | text→video | Реалистичное движение |
| `fal-ai/runway-gen3/turbo/text-to-video` | text→video | Художественное видео |

### Аудио / TTS

| Model ID | Описание |
|----------|---------|
| `fal-ai/elevenlabs/tts` | ElevenLabs TTS |
| `fal-ai/stable-audio` | Музыка/звуки |

### Утилиты

| Model ID | Что делает |
|----------|-----------|
| `fal-ai/birefnet` | Удаление фона (качественно) |
| `fal-ai/remove-background` | Удаление фона (быстро) |
| `fal-ai/esrgan` | Апскейл изображения |

---

## Паттерн для видео (fal.subscribe)

```js
const result = await fal.subscribe("fal-ai/kling-video/v2.1/standard/text-to-video", {
  input: {
    prompt: "cinematic drone shot over city at sunset",
    duration: "5",       // "5" | "10"
    aspect_ratio: "16:9",
  },
  logs: true,
  onQueueUpdate: (u) => {
    if (u.status === "IN_PROGRESS") u.logs?.forEach(l => console.log("[fal]", l.message));
  },
});
const videoUrl = result.data.video.url;
```

---

## Обработка ошибок

```js
try {
  const result = await fal.run("fal-ai/nano-banana-2", { input: { prompt } });
  return result.data;
} catch (err) {
  if (err.status === 401) console.error("Неверный FAL_KEY");
  else if (err.status === 422) console.error("Validation error:", err.body);
  else console.error("fal.ai error:", err.message);
  throw err;
}
```

---

## Примечания

- URL результатов временные (~1 час) — скачивай сразу
- `seed` фиксирует результат для воспроизводимости
- `thinking_level: "high"` улучшает сложные сцены, но медленнее
- `enable_web_search: true` полезен для генерации с актуальными визуальными референсами
- Загрузи ключ в Bash: `export $(cat ~/.claude/.env.fal)` перед запуском скриптов
