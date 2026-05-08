import { fal } from "@fal-ai/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "http://127.0.0.1:10809";
setGlobalDispatcher(new ProxyAgent(proxyUrl));
console.log(`🔗 Прокси: ${proxyUrl}`);

const envContent = fs.readFileSync(
  path.join(process.env.USERPROFILE || process.env.HOME, ".claude", ".env.fal"),
  "utf-8"
);
const falKey = envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim();
fal.config({ credentials: falKey });

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const prompt = `Vertical 9:16 photograph, 8K, ultra-realistic, editorial style.

SCENE: A large dark matte blackboard or dark chalkboard surface filling the entire frame. The board is clean, deep charcoal-black (#111111), slightly textured like a real marker board. No chalk dust, no erasure marks — just clean dark surface.

ON THE BOARD: Drawn with a thick orange marker (#D9540D), two rectangular boxes:
- LEFT BOX: titled "НПТЛ: результат" in bold orange capital letters, inside the box a few short horizontal orange lines suggesting listed items
- RIGHT BOX: titled "Как достичь?" in bold orange capital letters, inside the box only a large bold orange question mark filling the space

BETWEEN THE BOXES: A thick bold orange arrow pointing from left box toward right box, but the arrow is broken or interrupted in the middle — the line stops and then a large bold orange question mark hangs in the gap between the two boxes.

The orange marker drawing style is rough and energetic — thick strokes, slightly uneven lines as if drawn by a human hand quickly.

LIGHTING: Flat even soft lighting on the board, no dramatic shadows, just clean visibility of the marker drawings. Perhaps a very subtle warm light from slightly above.

MOOD: Corporate, analytical, urgent. The visual feeling: there is a goal (НПТЛ result), but the path to it is missing — question mark as the gap between target and method.

STYLE: Photorealistic photography of an actual physical blackboard. No CGI, no illustration, no cartoon look. Real board, real marker strokes. No people, no hands.`;

console.log("🎨 Генерирую фон — доска с маркером...");

try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: {
      prompt,
      aspect_ratio: "9:16",
      resolution: "2K",
      output_format: "jpeg",
      thinking_level: "high",
    },
  });

  const imgUrl = result.data?.images?.[0]?.url;
  if (!imgUrl) { console.error("❌ Нет URL", JSON.stringify(result.data)); process.exit(1); }

  const dest = path.join(__dirname, "image2.jpg");
  await download(imgUrl, dest);
  console.log(`✅ Сохранён: ${dest}`);
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}
