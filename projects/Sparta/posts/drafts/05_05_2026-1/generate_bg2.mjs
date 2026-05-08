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

const prompt = `Vertical 9:16 hyperrealistic cinematic photograph, 8K, corporate editorial style.

COMPOSITION: The frame is split HORIZONTALLY into two distinct zones with a sharp, hard cut — no gradient transition.

TOP ZONE (upper 55% of the frame):
- Warm, intense orange-amber light flooding the entire upper section
- Slightly out-of-focus, soft bokeh atmosphere — deliberate blur
- Several dark silhouettes of people in business suits, visible from the chest up, in animated postures — leaning in, gesturing with hands, turning heads — energy of active discussion and debate
- A large flipchart or whiteboard slightly off-center, covered in chaotic orange marker strokes: arrows pointing in multiple directions, circles, crossed-out lines, diagrams that trail off — the marks of live thinking and argument
- Orange backlight catches the shoulders and outlines of the silhouettes, creating warm rim lighting
- The overall feel: alive, kinetic, intellectual energy, the heat of a working session

BOTTOM ZONE (lower 45% of the frame):
- Deep matte black background, completely flat and still — #0a0a0a — no reflections, no noise
- In the center of this zone: ONE sheet of white A4 paper, pristine and perfectly clean, with no writing or marks of any kind
- The paper is attached to the dark surface by TWO strips of orange adhesive tape (washi tape / painter's tape), one at the top edge and one at the bottom edge of the paper
- A single cold directional light source from directly above casts a sharp, clean shadow from the tape strips onto the paper surface, and a very subtle specular highlight on the upper half of the paper
- The paper occupies roughly 50% of the frame width and about 30% of the frame height, centered horizontally
- The rest of the bottom zone is pure dark — empty space around the paper
- The empty paper IS the visual focal point of the entire image

DIVIDING LINE:
- The transition between top and bottom zones is a razor-sharp horizontal cut — no blur, no gradient — as if two photographs were placed edge to edge

LIGHTING:
- Top zone: warm orange, diffuse, theatrical — like a stage spotlight from above-front
- Bottom zone: single cold white/neutral directional beam from directly above, surgical precision

MOOD: The intellectual chaos of a group discussion above — the administrative emptiness of what was never written down below. The blank paper says everything.

STYLE: Ultra-realistic photography, cinematic, no ancient or historical elements, no decorative flourishes. Pure light, geometry, human silhouettes, and one empty sheet of paper.`;

console.log("🎨 Генерирую новый фон (горизонтальный split)...");
try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg", thinking_level: "high" },
  });
  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL"); process.exit(1); }
  await download(imgUrl, path.join(__dirname, "bg2.jpg"));
  console.log("✅ Сохранён: bg2.jpg");
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
