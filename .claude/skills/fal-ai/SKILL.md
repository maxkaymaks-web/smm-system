---
name: fal-ai
description: Генерирует изображения, видео, аудио через fal.ai API. Text-to-image — только nano-banana-2 (дефолт) или openai/gpt-image-2 (сложный текст на картинке). Видео/аудио/LLM — Kling, Veo, Sora, ElevenLabs, Kokoro, any-llm. Вызывай когда нужна генерация, удаление фона, апскейл, TTS, или когда упоминается fal.ai / FAL_KEY / nano-banana / gpt-image / kling. Включает reverse-prompt методологию — читай references/prompt-engineering.md перед любой генерацией.
---

# fal.ai — генерация через API

> **Политика по моделям (см. `global/rules.md`):**
> Text-to-image — разрешены ТОЛЬКО `fal-ai/nano-banana-2` (по умолчанию) и `openai/gpt-image-2` (для сложного текста / типографики на картинке).
> Никакие другие t2i (Flux, Ideogram, Recraft, Seedream, Qwen, Imagen, SDXL, Nano Banana Pro и т.п.) не используются.
> Img2img / inpainting / outpainting — через edit-эндпойнты тех же двух моделей.

## Промпт-инжиниринг (обязательно перед генерацией)

**Всегда читай `references/prompt-engineering.md`** — там полная методология:
- Структура SLCT (Subject / Look / Camera / Technical)
- **Reverse-prompt**: анализ референс-изображения → разбор на составляющие → написание точного промпта
- Итеративный цикл улучшения
- Модельно-специфичные паттерны (nano-banana-2, gpt-image-2, kling, veo)
- Шаблоны для SMM: продукт, портрет, архитектура, видео
- Анти-паттерны и техники усиления

**Кратко:** пиши как режиссёр, а не как тег-суп. Конкретный субъект → конкретный свет → конкретная камера → стиль.

---

## Конфигурация

**API-ключ:** `.env` в корне репо → `FAL_KEY=...`

**Установка:**
```bash
npm install @fal-ai/client
```

**Импорт (именованный, не default):**
```js
import { fal } from "@fal-ai/client";
fal.config({ credentials: process.env.FAL_KEY });
```

**Загрузить ключ в Bash-скрипт:**
```bash
export $(grep -v '^#' .env | xargs)
```

---

## Два метода вызова

| Метод | Когда использовать |
|-------|-------------------|
| `fal.run()` | **Изображения и быстрые модели** — sync, возвращает сразу |
| `fal.subscribe()` | **Видео и долгие задачи** — async queue с прогрессом |

> ⚠️ `queue.fal.run` может таймаутиться в некоторых сетях. Для изображений всегда используй `fal.run()`.

---

## Загрузка локальных файлов

```js
import { fal } from "@fal-ai/client";
import fs from "fs";

const buf = fs.readFileSync("photo.jpg");
const imageUrl = await fal.storage.upload(
  new Blob([buf], { type: "image/jpeg" }),
  { contentType: "image/jpeg" }
);
// imageUrl — временный URL для передачи в модели
```

---

## Скачать результат

```js
import https from "https";
import fs from "fs";

async function download(url, dest) {
  fs.mkdirSync(require("path").dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, r => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(dest); });
    }).on("error", reject);
  });
}
```

---

## ИЗОБРАЖЕНИЯ

Разрешены **ровно две модели**:

| Когда | Модель | Slug | Цена |
|---|---|---|---|
| Дефолт (фон, продукт, портрет, lifestyle) | Nano Banana 2 | `fal-ai/nano-banana-2` | $0.06–$0.16/img |
| Сложный/длинный/мультиязычный текст НА картинке, типографика, инфографика с разборчивыми надписями | GPT Image 2 | `openai/gpt-image-2` | $0.005–$0.40/img (по quality+size) |

Любая другая t2i-модель — нарушение политики (`global/rules.md`).

**Designer-агент:** только `node tools/generate-image.mjs ... [--model=nano-banana-2|gpt-image-2] [--quality=low|medium|high]` — никаких кастомных скриптов, прямых `fal.run`, `node -e`, или самописных `.mjs`. Обёртка грузит `.env`, ставит таймаут и считает spend — без неё легко получить молчаливый hang.

**Другие агенты** (analytics и т.п.): прямые `fal.run` допустимы при условии ручного таймаута.

**Прокси / `ECONNRESET` под VPN:** по умолчанию тулзы ходят в fal.ai напрямую — `HTTPS_PROXY` не нужен. Но если оператор сидит под VPN с локальным прокси (типично `127.0.0.1:10809`), прямые запросы режутся и валятся с `ECONNRESET` на аплоадах. Лечение: в `.env` добавить `FAL_PROXY=http://127.0.0.1:10809` — тулзы поднимут `undici ProxyAgent` и пустят трафик через прокси (Node `fetch` сам env-прокси НЕ читает). Все fal-вызовы идут через `tools/lib/fal-meter.mjs`, который ещё и ретраит сетевые обрывы (3 попытки; `TIMEOUT` не ретраится). Полный разбор и диагностика — `docs/fal-troubleshooting.md`. Тинипрокси `5.2.66.188:8888` — только для серверных процессов (исторический OpenClaw, выкл. 16.05.2026).

---

### nano-banana-2 (по умолчанию)

**Model ID:** `fal-ai/nano-banana-2` | Gemini-based, 4K, поддерживает web search и до 14 референс-изображений.

| Параметр | Тип | По умолч. | Описание |
|----------|-----|-----------|---------|
| `prompt` | string | — | **Обязательный** |
| `aspect_ratio` | enum | `auto` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9`, `4:1` |
| `resolution` | enum | `1K` | `0.5K` / `1K` / `2K` / `4K` |
| `output_format` | enum | `png` | `jpeg` / `png` / `webp` |
| `num_images` | integer | 1 | Количество изображений |
| `seed` | integer | — | Воспроизводимость |
| `safety_tolerance` | enum | `4` | Строгость 1–6 |
| `thinking_level` | enum | — | `minimal` / `high` (глубина обдумывания) |
| `enable_web_search` | boolean | — | Поиск в интернете для актуальных референсов |
| `image_urls` | string[] | — | До 14 референсов (img2img / multi-ref) |

**Вывод:**
```json
{
  "images": [{ "url": "...", "width": 1024, "height": 1024, "content_type": "image/png" }],
  "description": "Описание сгенерированного изображения"
}
```

**Пример:**
```js
const result = await fal.run("fal-ai/nano-banana-2", {
  input: {
    prompt: "cinematic photo of a red fox on snowy hill, golden hour",
    aspect_ratio: "16:9",
    resolution: "2K",
    output_format: "jpeg",
  },
});
const url = result.data.images[0].url;
```

---

### gpt-image-2 (только для сложного текста)

**Model ID:** `openai/gpt-image-2` | OpenAI, рендерит текст с пиксельной точностью, поддерживает мульти-язык, плотную типографику, до 4K.

Берём её **только** когда:
- На картинке должна быть длинная разборчивая надпись (заголовок-плакат, цитата, текст на упаковке, инфографика с цифрами/подписями)
- Несколько языков на одном изображении
- Художественная типографика, где nano-banana-2 ломает буквы

Для всего остального → nano-banana-2 дешевле в 2–10 раз и достаточно.

| Параметр | Тип | По умолч. | Описание |
|----------|-----|-----------|---------|
| `prompt` | string | — | **Обязательный** |
| `image_size` | enum/obj | `landscape_4_3` | preset (`square_hd`, `portrait_4_3`, `landscape_16_9`, …) или `{width, height}` до 3840px |
| `quality` | enum | `high` | `low` / `medium` / `high` — балансит цена/качество |
| `num_images` | integer | 1 | |
| `output_format` | enum | `png` | `jpeg` / `png` / `webp` |

**Пример:**
```js
const result = await fal.run("openai/gpt-image-2", {
  input: {
    prompt: "vintage travel poster reading 'SUMMER IN LISBON' in bold serif, terracotta and cream palette, art deco border",
    image_size: "portrait_4_3",
    quality: "high",
    output_format: "jpeg",
  },
});
const url = result.data.images[0].url;
```

**Img2img / inpainting (если нужно править существующее с текстом):** `openai/gpt-image-2/edit` — те же входы + `image_url` и опциональный `mask_url`. Это единственный разрешённый img2img/inpainting эндпойнт в проекте.

---

## УДАЛЕНИЕ ФОНА

| Model ID | Качество | Скорость |
|----------|----------|---------|
| `fal-ai/bria/background/remove` | ★★★ лучший | медленнее |
| `fal-ai/birefnet` | ★★★ высокое | средняя |
| `fal-ai/remove-background` | ★★ хорошее | быстро |

**Пример (BRIA RMBG 2.0):**
```js
const buf = fs.readFileSync("photo.jpg");
const imageUrl = await fal.storage.upload(new Blob([buf], { type: "image/jpeg" }));

const result = await fal.subscribe("fal-ai/bria/background/remove", {
  input: { image_url: imageUrl },
  logs: true,
  onQueueUpdate: (u) => u.logs?.forEach(l => console.log("[fal]", l.message)),
});
// result.data.image.url — PNG с прозрачным фоном
```

---

## АПСКЕЙЛ

| Model ID | Качество | Параметры |
|----------|----------|---------|
| `fal-ai/seedvr/upscale/image` | ★★★ лучший | до 4K, `upscale_factor` или `target_resolution` |
| `fal-ai/esrgan` | ★★ хорошее | быстрый, Real-ESRGAN |

**Пример (SeedVR2):**
```js
const imageUrl = await fal.storage.upload(...);

const result = await fal.subscribe("fal-ai/seedvr/upscale/image", {
  input: {
    image_url: imageUrl,
    upscale_factor: 2,   // или upscale_mode: "target", target_resolution: "2160p"
    output_format: "jpg",
  },
  logs: true,
  onQueueUpdate: (u) => u.logs?.forEach(l => console.log("[fal]", l.message)),
});
// result.data.image.url
```

---

## ВИДЕО: Text-to-Video

| Model ID | Цена | Описание | Когда |
|----------|------|---------|-------|
| `fal-ai/veo3.1` | $0.20–0.60/сек | Google Veo 3.1, топ качество + аудио | Лучшее возможное |
| `fal-ai/sora-2/text-to-video/pro` | $0.30–0.50/сек | OpenAI Sora 2 Pro | Художественное видео |
| `fal-ai/kling-video/o3/pro/text-to-video` | $0.224–0.28/сек | Kling 3 Pro (o3) | Кинематограф |
| `fal-ai/kling-video/v3/pro/text-to-video` | $0.224–0.39/сек | Kling 3.0 Pro | Кинематограф |
| `fal-ai/kling-video/v2.5-turbo/pro/text-to-video` | $0.07/сек | Kling 2.5 Turbo | Баланс цена/качество |
| `fal-ai/minimax/hailuo-2.3/pro/text-to-video` | $0.49/видео | Hailuo 2.3 Pro | Реалистичные сцены |
| `fal-ai/bytedance/seedance/v1.5/pro/text-to-video` | ~$0.26/5сек | Seedance 1.5 Pro (с аудио!) | Видео со звуком |
| `fal-ai/wan/v2.2-a14b/text-to-video` | $0.10/сек | Wan 2.2 (open source) | Баланс, open-source |
| `fal-ai/pixverse/v5/text-to-video` | $0.15–0.40/5сек | PixVerse v5.5 | Быстро, недорого |
| `fal-ai/vidu/q3/text-to-video/turbo` | $0.035/сек | Vidu Q3 Turbo | Самый дешёвый |
| `fal-ai/hunyuan-video` | ~$0.40/видео | HunyuanVideo (Tencent) | Open source, качество |
| `fal-ai/ltx-video` | дёшево | LTX Video | Быстро и бесплатно |

**Пример (Kling 2.5 Turbo — оптимальный):**
```js
const result = await fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/text-to-video", {
  input: {
    prompt: "cinematic drone shot over city at sunset, golden hour, 4K",
    duration: "5",        // "5" | "10"
    aspect_ratio: "16:9", // "16:9" | "9:16" | "1:1"
  },
  logs: true,
  onQueueUpdate: (u) => {
    if (u.status === "IN_PROGRESS") u.logs?.forEach(l => console.log("[fal]", l.message));
  },
});
const videoUrl = result.data.video.url;
```

---

## ВИДЕО: Image-to-Video

| Model ID | Цена | Описание |
|----------|------|---------|
| `fal-ai/veo3.1/image-to-video` | $0.10–0.60/сек | Google Veo 3.1, лучшее качество |
| `fal-ai/veo3.1/fast/image-to-video` | $0.10–0.35/сек | Veo 3.1 Fast |
| `fal-ai/kling-video/v3/pro/image-to-video` | $0.112–0.196/сек | Kling 3.0 Pro |
| `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | $0.07/сек | Kling 2.5 Turbo — оптимальный |
| `fal-ai/kling-video/v2.1/standard/image-to-video` | дешевле | Kling 2.1 Standard |
| `fal-ai/sora-2/image-to-video/pro` | $0.30–0.50/сек | Sora 2 Pro |
| `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` | — | Seedance 1.5 Pro (с аудио) |
| `fal-ai/minimax/hailuo-2.3/pro/image-to-video` | $0.49/видео | Hailuo 2.3 Pro |
| `fal-ai/minimax/hailuo-2.3/standard/image-to-video` | $0.49/видео | Hailuo 2.3 Standard |
| `fal-ai/ltx-2-19b/image-to-video` | $0.0018/MP | LTX-2 — очень дёшево |
| `fal-ai/pixverse/v5.6/image-to-video` | $0.35–0.75/клип | PixVerse v5.6 |
| `fal-ai/wan-pro/image-to-video` | — | Wan Pro |

**Пример (Kling 2.5 Turbo i2v):**
```js
const imgUrl = await fal.storage.upload(new Blob([fs.readFileSync("img.jpg")], { type: "image/jpeg" }));

const result = await fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
  input: {
    image_url: imgUrl,
    prompt: "gentle breeze, subtle camera movement",
    duration: "5",
    aspect_ratio: "16:9",
  },
  logs: true,
  onQueueUpdate: (u) => u.logs?.forEach(l => console.log("[fal]", l.message)),
});
const videoUrl = result.data.video.url;
```

---

## АУДИО / TTS

| Model ID | Цена | Описание |
|----------|------|---------|
| `fal-ai/elevenlabs/tts/eleven-v3` | ~$0.05/1K chars | ElevenLabs Eleven v3 — топ качество |
| `fal-ai/elevenlabs/tts/multilingual-v2` | — | ElevenLabs 29 языков |
| `fal-ai/elevenlabs/tts/turbo-v2.5` | — | ElevenLabs Turbo — real-time |
| `fal-ai/elevenlabs/audio-isolation` | — | Изоляция голоса из аудио |
| `fal-ai/elevenlabs/sound-effects` | — | Генерация звуковых эффектов |
| `fal-ai/elevenlabs/speech-to-text` | — | ElevenLabs STT |
| `fal-ai/kokoro/american-english` | $0.02/1K chars | Kokoro TTS — дёшево, хорошо |
| `fal-ai/kokoro/japanese` | $0.02/1K chars | Kokoro TTS японский |
| `fal-ai/kokoro/french` | $0.02/1K chars | Kokoro TTS французский |
| `fal-ai/kokoro/spanish` | $0.02/1K chars | Kokoro TTS испанский |
| `fal-ai/stable-audio` | — | Музыка и звуки |

**Пример (ElevenLabs):**
```js
const result = await fal.subscribe("fal-ai/elevenlabs/tts/eleven-v3", {
  input: {
    text: "Привет, это тестовый текст",
    voice_id: "21m00Tcm4TlvDq8ikWAM",  // Rachel
    model_id: "eleven_v3",
  },
  logs: true,
  onQueueUpdate: (u) => u.logs?.forEach(l => console.log("[fal]", l.message)),
});
const audioUrl = result.data.audio.url;
```

**Пример (Kokoro — дёшево):**
```js
const result = await fal.run("fal-ai/kokoro/american-english", {
  input: {
    text: "Hello, this is a test.",
    voice: "af_heart",  // american female heart
  },
});
const audioUrl = result.data.audio.url;
```

---

## LLM через fal.ai (any-llm)

**Model ID:** `fal-ai/any-llm`

Единый gateway для всех LLM моделей. Поддерживаемые модели:

| Провайдер | Model ID |
|-----------|---------|
| Anthropic | `anthropic/claude-sonnet-4.5`, `anthropic/claude-haiku-4.5`, `anthropic/claude-3.7-sonnet`, `anthropic/claude-3.5-sonnet` |
| Google | `google/gemini-2.5-pro`, `google/gemini-2.5-flash`, `google/gemini-2.5-flash-lite`, `google/gemini-2.0-flash-001` |
| OpenAI | `openai/gpt-4o`, `openai/gpt-4.1`, `openai/o3`, `openai/gpt-5-chat`, `openai/gpt-5-mini`, `openai/gpt-4o-mini` |
| Meta | `meta-llama/llama-4-maverick`, `meta-llama/llama-4-scout`, `meta-llama/llama-3.1-70b-instruct` |
| DeepSeek | `deepseek/deepseek-r1`, `deepseek/deepseek-v3.1-terminus` |

**Пример:**
```js
const result = await fal.run("fal-ai/any-llm", {
  input: {
    model: "google/gemini-2.5-flash",
    prompt: "Напиши краткое описание для изображения заката",
  },
});
console.log(result.data.output);
```

---

## Обработка ошибок

```js
try {
  const result = await fal.run("fal-ai/nano-banana-2", { input: { prompt } });
  return result.data;
} catch (err) {
  if (err.status === 401) throw new Error("Неверный FAL_KEY");
  if (err.status === 422) throw new Error(`Validation: ${JSON.stringify(err.body)}`);
  throw err;
}
```

---

## Быстрые рецепты

```
Изображение:     fal.run("fal-ai/nano-banana-2", { input: { prompt, aspect_ratio, resolution } })
Картинка с тек.: fal.run("openai/gpt-image-2",    { input: { prompt, image_size: "portrait_4_3", quality: "high" } })
T2V баланс:      fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/text-to-video", { input: { prompt, duration: "5", aspect_ratio: "16:9" } })
I2V:             fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", { input: { image_url, prompt, duration: "5" } })
Фон убрать:      fal.subscribe("fal-ai/bria/background/remove", { input: { image_url } })
Апскейл:         fal.subscribe("fal-ai/seedvr/upscale/image", { input: { image_url, upscale_factor: 2 } })
TTS:             fal.run("fal-ai/kokoro/american-english", { input: { text, voice: "af_heart" } })
LLM:             fal.run("fal-ai/any-llm", { input: { model: "google/gemini-2.5-flash", prompt } })
```

---

## Примечания

- URL результатов временные (~1 час) — скачивай сразу если нужно сохранить
- `seed` фиксирует результат для воспроизводимости
- `fal.storage.upload()` — для загрузки локальных файлов перед передачей в модели
- Старый пакет `@fal-ai/serverless-client` deprecated → используй `@fal-ai/client`
- Цены приблизительные — актуальные на [fal.ai/pricing](https://fal.ai/pricing)
