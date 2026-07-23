#!/usr/bin/env node
import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync } from "fs";

const envContent = readFileSync("/Users/maxkaymaks/CLAUDE/smm-system/.env", "utf-8");
const FAL_KEY = envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim();
if (!FAL_KEY) { console.error("FAL_KEY not found"); process.exit(1); }
fal.config({ credentials: FAL_KEY });

const posts = JSON.parse(readFileSync("/tmp/posts_fresh.json", "utf-8"));

const PROMPT = `Ты эксперт по анализу Instagram Reels в нише финансовой психологии. Проанализируй это видео ПОДРОБНО:
1. ХУК (первые 2 секунды): что в кадре, текст на экране, что цепляет — особенно важно для ниши «деньги/страхи/установки»
2. РАСКАДРОВКА ПО СЕКУНДАМ: каждая сцена с таймингом, что в кадре, текст оверлей, монтажные приёмы
3. РЕЧЬ/СУБТИТРЫ: что говорит за кадром дословно, есть ли субтитры
4. МУЗЫКА: жанр, темп, настроение, название если слышно
5. CTA внутри видео: есть ли призыв (лайк/коммент/репост/директ), точный текст
6. ГИПОТЕЗЫ ПОЧЕМУ ЗАЛЕТЕЛО: 3-5 причин, психологический триггер, фактор удержания
Отвечай по-русски. Описывай только то, что реально видишь/слышишь.`;

const results = [];

for (let i = 0; i < posts.length; i++) {
  const post = posts[i];
  const { shortCode, ownerUsername, videoPlayCount, caption, videoUrl } = post;

  if (!videoUrl) {
    console.error(`[${i+1}/${posts.length}] ${shortCode} — NO URL, skip`);
    continue;
  }

  console.error(`\n[${i+1}/${posts.length}] @${ownerUsername}/${shortCode} (${(videoPlayCount||0).toLocaleString()} views)...`);

  try {
    const result = await fal.subscribe("openrouter/router/video", {
      input: {
        video_urls: [videoUrl],
        prompt: PROMPT,
        model: "google/gemini-2.5-flash"
      },
      logs: false,
      onQueueUpdate: (update) => {
        if (update.status) process.stderr.write(`  ${update.status}\n`);
      }
    });

    const analysisText = result?.data?.output || result?.output || JSON.stringify(result);
    console.error(`  OK! ${String(analysisText).length} chars`);

    results.push({
      shortCode,
      owner: ownerUsername,
      views: videoPlayCount || 0,
      caption: (caption || "").slice(0, 200),
      analysis: analysisText
    });

  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    results.push({ shortCode, owner: ownerUsername, views: videoPlayCount || 0, error: err.message });
  }
}

writeFileSync("/tmp/reels_analysis.json", JSON.stringify(results, null, 2));
console.error(`\nSaved ${results.length} analyses to /tmp/reels_analysis.json`);
