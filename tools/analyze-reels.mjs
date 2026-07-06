#!/usr/bin/env node
/**
 * analyze-reels.mjs — анализ Instagram Reels через fal.ai openrouter/router/video
 * Usage: node tools/analyze-reels.mjs <video_file> <shortCode>
 */

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");
let FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY && fs.existsSync(envPath)) {
  FAL_KEY = fs.readFileSync(envPath, "utf-8").match(/FAL_KEY=(.+)/)?.[1]?.trim();
}
if (!FAL_KEY) { console.error("FAL_KEY not found"); process.exit(1); }
fal.config({ credentials: FAL_KEY });

const [,, videoFile, shortCode = "unknown"] = process.argv;

if (!videoFile || !fs.existsSync(videoFile)) {
  console.error(`File not found: ${videoFile}`);
  process.exit(1);
}

const size = fs.statSync(videoFile).size / 1024 / 1024;
console.error(`Uploading ${shortCode} (${size.toFixed(1)} MB)...`);

const blob = new Blob([fs.readFileSync(videoFile)], { type: "video/mp4" });
const videoUrl = await fal.storage.upload(blob);
console.error(`Uploaded: ${videoUrl.slice(0, 60)}...`);

const prompt = `Ты эксперт по анализу Instagram Reels. Проанализируй это видео ПОДРОБНО:
1. ХУК (первые 2 секунды): что в кадре, текст на экране, что цепляет
2. РАСКАДРОВКА ПО СЕКУНДАМ: каждая сцена с таймингом, что в кадре, текст оверлей, монтажные приёмы
3. РЕЧЬ/СУБТИТРЫ: что говорит за кадром дословно, есть ли субтитры
4. МУЗЫКА: жанр, темп, настроение, название если слышно
5. CTA внутри видео: есть ли призыв (лайк/коммент/репост/директ), точный текст
6. ГИПОТЕЗЫ ПОЧЕМУ ЗАЛЕТЕЛО: 3-5 причин, психологический триггер, фактор удержания
Отвечай по-русски. Описывай только то, что реально видишь/слышишь.`;

const result = await fal.subscribe("openrouter/router/video", {
  input: {
    video_urls: [videoUrl],
    prompt,
    model: "google/gemini-2.5-flash"
  },
  logs: false,
});

const analysis = {
  shortCode,
  videoFile: path.basename(videoFile),
  analysis: result?.data?.output || result?.output || JSON.stringify(result),
};

console.log(JSON.stringify(analysis, null, 2));
