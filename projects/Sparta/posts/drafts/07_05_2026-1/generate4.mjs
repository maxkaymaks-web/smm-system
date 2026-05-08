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

const prompt = `Vertical 9:16 cinematic photograph, 8K ultra-realistic, professional photography.

SCENE: A dark empty university classroom or lecture hall. Rows of desks and chairs are barely visible as dark silhouettes. A large blackboard on the wall at the front. The room is completely empty — no people. Late evening.

LIGHT SOURCE: A single tall window on one side wall. Through the window — a deep orange sunset sky, warm amber and burnt orange tones. The evening light streams through the window casting a sharp bright orange rectangle of light on the dark classroom floor. This is the only significant light source. Everything else in the room is in deep shadow.

DETAILS: On the nearest desk in the foreground — the edge of a stack of papers barely visible in the shadow. The blackboard is dark and empty. The chairs and desks form perspective lines going into the dark background.

ATMOSPHERE: End of working day. Deadline approaching. The university has gone quiet before reporting season. Heavy silence. The orange light patch on the floor is almost theatrical — a spotlight with no actor.

LIGHTING: Single-source dramatic — only the window. The orange rectangle of light on the floor is sharp and vivid. Everything else fades to near-black. Strong chiaroscuro contrast.

MOOD: Melancholic urgency, institutional quiet, the weight of bureaucratic deadlines. No people, no movement.

STYLE: Ultra-realistic photography, cinematic wide angle slightly low perspective, sharp foreground desks, deep dark background. Film quality grain. Moody editorial look.`;

console.log("🎨 Генерирую — тёмная аудитория...");
try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt, aspect_ratio: "9:16", resolution: "2K", output_format: "jpeg", thinking_level: "high" },
  });
  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL"); process.exit(1); }
  await download(imgUrl, path.join(__dirname, "image4.jpg"));
  console.log("✅ Сохранён: image4.jpg");
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
