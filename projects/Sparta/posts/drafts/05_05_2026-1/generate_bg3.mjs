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

const prompt = `Vertical 9:16 abstract background, 8K, for corporate graphic design overlay.

Pure deep matte black background (#0a0a0a). No people, no objects, no scene.

LIGHTING / GRADIENT ACCENT:
- A single large diagonal light sweep from upper-left to lower-right — warm deep orange (#C85000) fading to transparent. The light source feels like a distant powerful spotlight behind fog.
- A secondary subtle radial orange glow in the upper-right quadrant — diffuse, atmospheric, like backlit smoke or haze. Very soft edges.
- Lower-left corner: pure black, no light.
- Overall: 85% of the frame is pure dark black. Only 15% has the warm orange atmospheric glow.

TEXTURE:
- Very subtle film grain texture on the black areas
- Slight light scatter in the orange glow zone — cinematic haze, not sharp
- No geometric shapes, no lines, no patterns

MOOD: Premium corporate, mysterious, powerful. Like a dark stage before a speaker steps into the spotlight.

STYLE: Abstract atmospheric photography background. Ultra-clean. Designed to have text and graphic elements placed on top of it.`;

console.log("🎨 Генерирую тёмный фон с оранжевым градиентом...");
try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg", thinking_level: "high" },
  });
  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL"); process.exit(1); }
  await download(imgUrl, path.join(__dirname, "bg3.jpg"));
  console.log("✅ Сохранён: bg3.jpg");
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
