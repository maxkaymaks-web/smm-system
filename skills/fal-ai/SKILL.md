---
name: fal-ai
description: Генерирует изображения, видео, аудио через fal.ai API. 600+ моделей: Flux, nano-banana-2, Kling, Veo, Sora, Seedance, Wan, ElevenLabs, Kokoro и др. Вызывай когда нужна генерация изображений, видео, аудио, редактирование фото, удаление фона, апскейл, TTS, или когда упоминается fal.ai / FAL_KEY / nano-banana / flux / kling. Включает reverse-prompt методологию — читай references/prompt-engineering.md перед любой генерацией.
---

# fal.ai — генерация через API

## Промпт-инжиниринг (обязательно перед генерацией)

**Всегда читай `references/prompt-engineering.md`** — там полная методология:
- Структура SLCT (Subject / Look / Camera / Technical)
- **Reverse-prompt**: анализ референс-изображения → разбор на составляющие → написание точного промпта
- Итеративный цикл улучшения
- Модельно-специфичные паттерны (nano-banana-2, flux, kling, veo)
- Шаблоны для SMM: продукт, портрет, архитектура, видео
- Анти-паттерны и техники усиления

**Кратко:** пиши как режиссёр, а не как тег-суп. Конкретный субъект → конкретный свет → конкретная камера → стиль.

---

## Конфигурация

**API-ключ:** `~/.claude/.env.fal` → `FAL_KEY=...` (также в `~/.claude/settings.json`)

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
export $(cat ~/.claude/.env.fal)
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

### Основная модель: nano-banana-2

**Model ID:** `fal-ai/nano-banana-2`  
**Цена:** ~$0.06–$0.16/изображение

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
| `limit_generations` | boolean | `true` | Лимит 1 генерация на промпт |

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

### Все модели для изображений

| Model ID | Название | Цена | Когда использовать |
|----------|----------|------|--------------------|
| `fal-ai/nano-banana-2` | Nano Banana 2 | $0.06–0.16 | **По умолчанию.** Gemini-based, 4K, web search |
| `fal-ai/nano-banana-pro` | Nano Banana Pro | $0.15 | Максимальное качество |
| `fal-ai/flux-2-pro` | FLUX.2 [pro] | $0.03/MP | Топ фотореализм 2026 |
| `fal-ai/flux-pro/v1.1-ultra` | FLUX Pro 1.1 Ultra | $0.06 | Фотореализм, 16:9 |
| `fal-ai/flux/dev` | FLUX.1 [dev] | ~$0.025 | Баланс качество/скорость |
| `fal-ai/flux/schnell` | FLUX.1 [schnell] | ~$0.003 | Черновики, 4 steps, ультра-быстро |
| `fal-ai/bytedance/seedream/v4.5/text-to-image` | Seedream V4.5 | $0.04 | ByteDance, высокое качество |
| `fal-ai/recraft/v3/text-to-image` | Recraft V3 | $0.04–0.08 | Векторный / дизайн стиль |
| `fal-ai/ideogram/v3` | Ideogram V3 | $0.03–0.09 | **Лучший для текста на изображении** |
| `fal-ai/gpt-image-1.5` | GPT Image 1.5 | $0.009–0.20 | OpenAI, мультиреференс |
| `fal-ai/qwen-image-max/text-to-image` | Qwen Image Max | $0.075 | Alibaba, китайские промпты |

**Правило выбора:**
- Общая генерация → `nano-banana-2`
- Черновик быстро → `flux/schnell`
- Фотореализм → `flux-2-pro` или `flux-pro/v1.1-ultra`
- Текст на изображении → `ideogram/v3`
- Дизайн/вектор → `recraft/v3/text-to-image`

---

## РЕДАКТИРОВАНИЕ ИЗОБРАЖЕНИЙ

| Model ID | Цена | Что делает |
|----------|------|-----------|
| `fal-ai/flux/dev/image-to-image` | ~$0.025 | Style transfer, img2img |
| `fal-ai/flux-pro/v1/fill` | $0.05/MP | Inpainting (маска + промпт) |
| `fal-ai/flux-general/inpainting` | — | FLUX Dev + ControlNet + LoRA инпейнтинг |
| `fal-ai/flux-kontext-lora/inpaint` | $0.035/MP | Flux Kontext LoRA инпейнтинг |
| `fal-ai/flux-lora/inpainting` | — | FLUX LoRA инпейнтинг |

**Пример img2img:**
```js
const result = await fal.run("fal-ai/flux/dev/image-to-image", {
  input: {
    image_url: "https://...",
    prompt: "same scene but in winter, snowy",
    strength: 0.75,  // 0.0 = оригинал, 1.0 = полная генерация
  },
});
```

**Пример inpainting (FLUX Pro Fill):**
```js
const result = await fal.subscribe("fal-ai/flux-pro/v1/fill", {
  input: {
    image_url: "https://...",
    mask_url: "https://...",  // белые пиксели = редактировать
    prompt: "a red sports car",
  },
  logs: true,
  onQueueUpdate: (u) => u.logs?.forEach(l => console.log(l.message)),
});
```

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

## ОБУЧЕНИЕ / LoRA

| Model ID | Цена | Описание |
|----------|------|---------|
| `fal-ai/flux-lora-fast-training` | $2/run | FLUX LoRA быстрое обучение (9–50 фото) |
| `fal-ai/flux-2-trainer` | $0.008/step | FLUX.2 LoRA fine-tuning |
| `fal-ai/hunyuan-video-lora-training` | — | HunyuanVideo LoRA |
| `fal-ai/z-image-trainer` | — | Z-Image LoRA тренер |
| `fal-ai/ltx-2-19b/video-to-video/lora` | — | LTX-2 video LoRA |

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
Черновик img:    fal.run("fal-ai/flux/schnell", { input: { prompt, image_size: "landscape_16_9" } })
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
