#!/usr/bin/env node
/**
 * generate-image.mjs — fal.ai image generation CLI
 *
 * Разрешённые модели (политика проекта, см. global/rules.md):
 *   - fal-ai/nano-banana-2     — дефолт, общая генерация
 *   - openai/gpt-image-2       — только когда нужен разборчивый длинный текст
 *                                / сложная типографика / мульти-язык на картинке
 *
 * Использование:
 *   node tools/generate-image.mjs <prompt> <output.jpg> [aspect_ratio] [resolution] [--model=nano-banana-2|gpt-image-2] [--quality=low|medium|high] [--ref=path1.jpg,path2.jpg]
 *
 * aspect_ratio: 1:1 | 16:9 | 9:16 | 4:3 | 3:4         (default: 3:4 для портретных постов)
 * resolution:   0.5K | 1K | 2K | 4K                    (используется nano-banana-2; default: 1K)
 * --quality:    low | medium | high                    (только gpt-image-2; default: high)
 * --ref:        локальные файлы-референсы (img2img/edit, до 14, только nano-banana-2) —
 *               загружаются в fal storage автоматически
 *
 * Requires: npm install @fal-ai/client
 * API key:  .env (репо-рут) → FAL_KEY=...
 */

import { fal } from "@fal-ai/client";
import fs from "fs";
import https from "https";
import path from "path";
import { meter } from "../tools/lib/fal-meter.mjs";
import { ProxyAgent, fetch as undiciFetch } from "undici";

// Node fetch (undici) не подхватывает HTTPS_PROXY сам — без этого длинные запросы
// к fal.ai (15-30s генерация) рвутся ECONNRESET на сетях, где прямой выход блокируется
// и требуется локальный прокси (см. .env HTTPS_PROXY). Передаём fetch с явным
// dispatcher прямо в fal.config(), а не через setGlobalDispatcher — надёжнее.
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
const falFetch = proxyAgent
  ? (url, init) => undiciFetch(url, { ...init, dispatcher: proxyAgent })
  : undefined;

const envPath = path.join(process.cwd(), ".env");
let FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  FAL_KEY = envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim();
}
if (!FAL_KEY) {
  console.error("FAL_KEY not found. Set in .env (repo root) or env.");
  process.exit(1);
}

fal.config({ credentials: FAL_KEY, ...(falFetch ? { fetch: falFetch } : {}) });

async function downloadFile(url, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (r) => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(outputPath); });
    }).on("error", reject);
  });
}

const ALLOWED_MODELS = new Set(["nano-banana-2", "gpt-image-2"]);

const rawArgs = process.argv.slice(2);
const positional = [];
const flags = {};
for (const a of rawArgs) {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) flags[m[1]] = m[2];
  else positional.push(a);
}

const [prompt, outputPath, aspectRatio = "3:4", resolution = "1K"] = positional;
const model = flags.model ?? "nano-banana-2";
const quality = flags.quality ?? "high";

if (!prompt || !outputPath) {
  console.error("Usage: node tools/generate-image.mjs <prompt> <output.jpg> [aspect_ratio] [resolution] [--model=nano-banana-2|gpt-image-2] [--quality=low|medium|high]");
  console.error("Example (default): node tools/generate-image.mjs \"elegant beauty studio interior\" assets/bg.jpg 3:4 1K");
  console.error("Example (text-heavy): node tools/generate-image.mjs \"poster reading 'SUMMER SALE' bold red\" assets/poster.jpg 1:1 --model=gpt-image-2 --quality=high");
  process.exit(1);
}

if (!ALLOWED_MODELS.has(model)) {
  console.error(`Model '${model}' not allowed. Use one of: ${[...ALLOWED_MODELS].join(", ")}.`);
  console.error("Политика проекта (global/rules.md): только nano-banana-2 (default) или gpt-image-2 (для сложного текста).");
  process.exit(1);
}

// nano-banana-2 описывает сцену — только английский. Кириллица = encoding-баг агента.
// gpt-image-2 специально для текста на картинке — кириллица в промпте допустима.
if (model === "nano-banana-2" && /[а-яёА-ЯЁ]/.test(prompt)) {
  console.error("ОШИБКА: промпт для nano-banana-2 содержит кириллицу.");
  console.error("Описание сцены/фона всегда на английском. Русский текст на картинке — через HTML/CSS поверх.");
  console.error(`Получено: "${prompt}"`);
  process.exit(1);
}

// gpt-image-2 принимает image_size как preset name или { width, height }.
// Сопоставление aspect_ratio → image_size preset из fal.ai.
const ASPECT_TO_SIZE = {
  "1:1":  "square_hd",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
  "4:3":  "landscape_4_3",
  "3:4":  "portrait_4_3",
};

// nano-banana-2 быстрый (~15-30s), gpt-image-2 quality=high может идти до 5 минут
const TIMEOUT_MS = model === "gpt-image-2" ? 300_000 : 120_000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT after ${ms / 1000}s. Это НЕ проблема промпта — fal.ai перегружен. Не переформулируй промпт, не retry — останови задачу и сообщи оператору.`)), ms)
    ),
  ]);
}

let imageUrls;
if (flags.ref) {
  if (model !== "nano-banana-2") {
    console.error("--ref (img2img) поддерживается только для nano-banana-2.");
    process.exit(1);
  }
  const refPaths = flags.ref.split(",").map((p) => p.trim()).filter(Boolean);
  console.log(`Encoding ${refPaths.length} reference image(s) as data URI...`);
  const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  imageUrls = refPaths.map((p) => {
    const ext = path.extname(p).toLowerCase();
    const mime = MIME[ext] ?? "image/jpeg";
    const b64 = fs.readFileSync(p).toString("base64");
    return `data:${mime};base64,${b64}`;
  });
}

console.log(`Generating: "${prompt}"`);
console.log(`Output: ${outputPath} | model=${model} | ${aspectRatio}${model === "nano-banana-2" ? ` | ${resolution}` : ` | quality=${quality}`}${imageUrls ? ` | refs=${imageUrls.length}` : ""}`);

let result;

try {
  if (model === "nano-banana-2") {
    result = await meter(
      { tool: "generate-image", model: "fal-ai/nano-banana-2", params: { resolution, aspect_ratio: aspectRatio, num_images: 1, has_refs: !!imageUrls } },
      () => withTimeout(fal.run("fal-ai/nano-banana-2", {
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          resolution,
          output_format: "jpeg",
          num_images: 1,
          ...(imageUrls ? { image_urls: imageUrls } : {}),
        },
      }), TIMEOUT_MS)
    );
  } else {
    const imageSize = ASPECT_TO_SIZE[aspectRatio] ?? "portrait_4_3";
    result = await meter(
      { tool: "generate-image", model: "openai/gpt-image-2", params: { image_size: imageSize, quality, num_images: 1 } },
      () => withTimeout(fal.run("openai/gpt-image-2", {
        input: {
          prompt,
          image_size: imageSize,
          quality,
          output_format: "jpeg",
          num_images: 1,
        },
      }), TIMEOUT_MS)
    );
  }
} catch (err) {
  console.error(`fal.ai ERROR: ${err.message}`);
  console.error("Генерация остановлена. Никаких фоллбэков. Попробуй позже.");
  process.exit(2);
}

const imageUrl = result?.data?.images?.[0]?.url;
if (!imageUrl) {
  console.error("fal.ai вернул пустой ответ (нет URL изображения).");
  console.error("Генерация остановлена. Никаких фоллбэков.");
  process.exit(2);
}

await downloadFile(imageUrl, outputPath);

const stat = fs.statSync(outputPath);
if (stat.size === 0) {
  fs.unlinkSync(outputPath);
  console.error(`Файл ${outputPath} оказался пустым (0 байт) — скачивание не удалось.`);
  console.error("Генерация остановлена. Никаких фоллбэков.");
  process.exit(2);
}

console.log("✓ Saved:", outputPath, `(${stat.size} bytes)`);
if (result.data.description) console.log("  Description:", result.data.description);
