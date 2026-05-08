import { fal } from "@fal-ai/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "http://127.0.0.1:10809";
setGlobalDispatcher(new ProxyAgent(proxyUrl));
const envContent = fs.readFileSync(path.join(process.env.USERPROFILE || process.env.HOME, ".claude", ".env.fal"), "utf-8");
fal.config({ credentials: envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim() });

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const prompt = `Vertical 9:16 cinematic photograph, 8K ultra-realistic, premium corporate editorial.

OVERALL: Deep matte black background (#080808). Warm orange-amber light illuminates the scene from a single overhead spotlight. NO SMOKE. NO FOG. NO HAZE. NO ATMOSPHERIC PARTICLES. NO MIST. Clean, sharp, dry air. The light transitions cleanly from lit areas to shadow — no diffusion, no smoke effect.

PEOPLE: A group of 5-6 businesspeople in dark suits, shot from the waist up, gathered around a flipchart covered in orange marker diagrams and arrows. They are in active discussion — gesturing, leaning in, one person pointing at the board with a marker. The people are in the upper portion of the frame, occupying the upper 55% of the image. Their faces and shoulders are lit by the warm orange-amber overhead light, creating clean warm highlights on skin and fabric.

The edges of the group dissolve naturally into the dark background — not through smoke or fog, but through natural photographic depth-of-field blur and shadow fall-off. The transition from light to dark is purely shadow, not haze.

LOWER PORTION: The bottom 45% of the frame is predominantly dark — deep black, with only a faint warm reflection of light from the scene above. No people in this area. Clean empty dark space.

LIGHTING: Single warm overhead spotlight. Clean hard-edge shadows. No diffusion. No smoke particles. No atmospheric effects whatsoever. The orange light is warm and theatrical but CLEAN.

NO: smoke, fog, haze, mist, atmospheric particles, light rays through particles, volumetric lighting effects.

STYLE: Ultra-realistic clean corporate photography. Sharp focus on the people. Natural bokeh only from depth of field, not from smoke or haze.`;

console.log("🎨 Генерирую фото без дымки...");
try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg", thinking_level: "high" },
  });
  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL"); process.exit(1); }
  await download(imgUrl, path.join(__dirname, "bg5.jpg"));
  console.log("✅ Сохранён: bg5.jpg");
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
