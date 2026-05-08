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

OVERALL: Deep matte black background (#080808) with a dramatic warm orange atmospheric diagonal light sweep from upper-right to lower-left — like a powerful stage spotlight cutting through smoke. The orange glow is rich, deep, cinematic.

PEOPLE: In the upper-right area of the frame — a group of 4-5 businesspeople in dark suits, shot from the waist up, gathered around a flipchart covered in orange marker diagrams and arrows. They are in active heated discussion — gesturing, leaning in, one person pointing at the board. They are LIT ENTIRELY BY THE ORANGE GRADIENT LIGHT — their faces and shoulders glow warm amber, no separate lighting. They organically emerge FROM the orange glow, as if they ARE part of the light. No sharp cutout edges. Their silhouettes blend and dissolve naturally into the dark background on the sides and bottom — the transition from people to black background is a natural photographic bokeh fade, not a hard edge.

The people occupy roughly the upper-right 40% of the frame. The rest of the frame — especially the left side and the bottom two-thirds — is predominantly dark, with only the atmospheric orange diagonal glow. Plenty of dark space for text overlay.

COMPOSITION: The orange diagonal light beam runs from upper-right (where the people are) toward lower-left, gradually fading to pure black. This creates a natural visual connection between the warm human scene in the upper-right and the dark empty space where text will go.

LIGHTING: Single unified warm orange-amber light source. Everything is lit by it — the people, the flipchart, the atmosphere. No cold lights, no fill lights. Only the warm orange and the dark.

STYLE: Ultra-realistic photography. No hard edges between subjects and background — organic photographic transitions. Film grain. Premium corporate mood.`;

console.log("🎨 Генерирую единое фото: мужчины + тёмный градиент...");
try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg", thinking_level: "high" },
  });
  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL"); process.exit(1); }
  await download(imgUrl, path.join(__dirname, "bg4.jpg"));
  console.log("✅ Сохранён: bg4.jpg");
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
