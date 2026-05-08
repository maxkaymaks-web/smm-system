import { fal } from "@fal-ai/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "http://127.0.0.1:10809";
setGlobalDispatcher(new ProxyAgent(proxyUrl));

const envContent = fs.readFileSync(
  path.join(process.env.USERPROFILE || process.env.HOME, ".claude", ".env.fal"),
  "utf-8"
);
fal.config({ credentials: envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim() });

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const prompt = `Vertical 9:16 cinematic photograph, 8K ultra-realistic.

SCENE: Pure black background, completely dark room. Two laptop computers or monitors placed side by side on a dark desk, shot from slightly above and in front. Both screens are glowing — they are the only light source in the entire scene.

LEFT LAPTOP SCREEN: Glowing warm orange light. On the screen — an orange-tinted spreadsheet or data table with rows and columns. In the upper area of the screen, bold text reads "НПТЛ" in large orange letters. The orange glow from this screen softly illuminates the left side of the scene.

RIGHT LAPTOP SCREEN: Same warm orange glow but slightly cooler tone. On the screen — another spreadsheet or dashboard. Bold text reads "Приоритет 2030" in large orange letters. The glow from this screen illuminates the right side.

BETWEEN THE TWO SCREENS: A thin glowing orange horizontal line or connector that starts from the edge of the left screen and reaches toward the right screen — but stops abruptly in the middle, going nowhere. The gap between the screens is dark empty space. This visual metaphor: two parallel tracks, no real connection.

ATMOSPHERE: Deep darkness everywhere except the two screen glows. The desk surface barely visible as a dark reflection of the orange screens. No people, no hands, no objects — only the two laptops and empty black space.

LIGHTING: Only the two screens emit light. Orange-tinted ambient glow on nearby surfaces. Everything else is pure black shadow.

MOOD: Corporate, analytical, tension of disconnection. Two systems running in parallel, not communicating.

STYLE: Ultra-realistic photography, cinematic, shallow depth of field, sharp on screens, background completely dark. No illustration, no cartoon, no CGI look.`;

console.log("🎨 Генерирую — два монитора...");

try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg", thinking_level: "high" },
  });

  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL"); process.exit(1); }

  await download(imgUrl, path.join(__dirname, "image3.jpg"));
  console.log("✅ Сохранён: image3.jpg");
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
