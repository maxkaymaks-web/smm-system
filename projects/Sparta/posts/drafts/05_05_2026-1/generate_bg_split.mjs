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

const prompt = `Vertical 9:16 cinematic photograph, 8K ultra-realistic, bold graphic editorial style.

COMPOSITION: The frame is divided into two distinct vertical zones by a thin vertical line roughly 30% from the left edge.

LEFT ZONE (30% of frame width):
- Warm, intense orange-amber light fills the entire left portion
- Slightly out-of-focus, dreamy atmosphere
- A dark silhouette of a person in business attire stands at a whiteboard or glass wall, facing it, back to camera — only the dark silhouette shape is visible, no face, no details
- The glass wall or whiteboard behind the silhouette has blurred, illegible orange marker scribbles and diagrams, not readable
- The orange light is the dominant atmosphere — warm, intense, almost theatrical

RIGHT ZONE (70% of frame width):
- Deep matte black background, completely flat, #111111 — no texture, no gradient, no reflections
- Completely empty — this area is reserved for text overlay

DIVIDING LINE:
- A thin sharp vertical orange line (#D9540D) separates the two zones, running the full height of the frame
- The line is clean and precise, like a design element

LIGHTING: Left zone — single warm amber/orange light source from above-left, theatrical, like a spotlight. Right zone — pure darkness, no light spill from the left.

STYLE: Bold minimalist poster aesthetic, corporate, no ancient or historical elements. Ultra-realistic photography meets graphic design. Film grain texture.`;

console.log("🎨 Генерирую фон (split design)...");
try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg", thinking_level: "high" },
  });
  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL"); process.exit(1); }
  await download(imgUrl, path.join(__dirname, "bg.jpg"));
  console.log("✅ Сохранён: bg.jpg");
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
