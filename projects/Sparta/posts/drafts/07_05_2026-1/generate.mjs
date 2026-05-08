import { fal } from "@fal-ai/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "http://127.0.0.1:10809";
setGlobalDispatcher(new ProxyAgent(proxyUrl));
console.log(`🔗 Используем прокси: ${proxyUrl}`);

const envContent = fs.readFileSync(
  path.join(process.env.USERPROFILE || process.env.HOME, ".claude", ".env.fal"),
  "utf-8"
);
const falKey = envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim();
fal.config({ credentials: falKey });

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  return dest;
}

const prompt = `Vertical 9:16 professional editorial photograph, 8K quality, cinematic.

SCENE: Dark matte black background (#111111). The blurred background shows a university meeting room or vice-rector's office — dark leather chairs barely visible, edge of a long conference table, closed laptop in deep shadow. No people anywhere.

FOREGROUND: On the dark table surface, several sheets of white paper with printed text and simple bar charts and data graphs — slightly scattered, as if just reviewed. One sheet clearly shows a table with rows and columns. On top of the papers — an orange adhesive sticky note with the handwritten text "дедлайн: май–июнь" in neat black handwriting. Beside the papers — an orange marker pen, uncapped, lying diagonally.

LIGHTING: Single warm orange-tinted spotlight from directly above, tight beam, illuminating only the papers and marker on the table. Everything else — the chairs, the background, the table edges — fades into deep dark shadow. Dramatic chiaroscuro, high contrast.

MOOD: Strict, urgent, analytical, corporate. No fantasy, no ancient elements, no people, no game elements.

COLOR PALETTE: Deep black #111111, matte dark surfaces, warm orange #D9540D accent light on documents, white paper, dark shadows everywhere else.

STYLE: Real photographic quality, 8K, sharp focus on documents, shallow depth of field with background blurred. Shot from slightly above at 40-degree angle looking down at the table. Ultra-realistic, no CGI look, no cartoon, no illustration — pure photography.`;

console.log("🎨 Генерирую изображение...");

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
  if (!imgUrl) {
    console.error("❌ Нет URL", JSON.stringify(result.data));
    process.exit(1);
  }

  const dest = path.join(__dirname, "image.jpg");
  await download(imgUrl, dest);
  console.log(`✅ Сохранён: ${dest}`);
} catch (err) {
  console.error("❌ Ошибка:", err.message || err);
}

console.log("✅ Готово!");
