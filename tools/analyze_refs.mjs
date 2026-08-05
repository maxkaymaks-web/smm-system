import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");
let FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY && fs.existsSync(envPath)) {
  FAL_KEY = fs.readFileSync(envPath, "utf-8").match(/FAL_KEY=(.+)/)?.[1]?.trim();
}
fal.config({ credentials: FAL_KEY });

const videos = [
  { code: "DXbG8x0DbsK", views: 24097, caption: "А какие вы странные слова слышите на приеме?", file: "/tmp/sofia_refs/DXbG8x0DbsK.mp4" },
  { code: "DYOyd5OSu7K", views: 129395, caption: "Кому дать лучшую женскую роль?", file: "/tmp/sofia_refs/DYOyd5OSu7K.mp4" }
];

for (const v of videos) {
  console.error(`\nUploading ${v.code} (${(fs.statSync(v.file).size/1024/1024).toFixed(1)} MB)...`);
  const blob = new Blob([fs.readFileSync(v.file)], { type: "video/mp4" });
  const videoUrl = await fal.storage.upload(blob);
  console.error(`Uploaded: ${videoUrl}`);

  const result = await fal.run("fal-ai/any-llm/vision", {
    input: {
      model: "google/gemini-2.5-flash",
      video_urls: [videoUrl],
      prompt: `Анализируй Instagram Reels. Caption: "${v.caption}". Детально опиши:
1. ХУК: первые 2-3 секунды — что в кадре, текст на экране, что говорит/делает человек
2. СТРУКТУРА: как развивается видео поэтапно
3. ФОРМАТ: тип (юмор/скетч/образовательный/ролевая игра/закулисье/реакция)
4. ТЕКСТ НА ЭКРАНЕ: точный текст, расположение
5. ДИАЛОГ: кто говорит, что именно, сколько персонажей
6. МОНТАЖ: темп, переходы
7. CTA в конце
8. ТОНАЛЬНОСТЬ
Отвечай по каждому пункту, подробно.`
    }
  });

  console.log(`\n=== ${v.code} (${v.views} views) ===`);
  console.log(result.output);
}
