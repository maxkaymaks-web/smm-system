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

const prompt = `Vertical 9:16 cinematic photograph, 8K ultra-realistic, editorial style.

SCENE: Dark overhead or slightly angled view of a large dark conference table after a strategy meeting. The room is empty — everyone has left. Moody, dramatic lighting from a single overhead source casting warm orange-amber light only on the center of the table.

ON THE TABLE:
- Several sheets of paper scattered around, some with printed text and hand-drawn arrows and diagrams
- Multiple colorful sticky notes with handwritten scribbles
- A few orange and black markers lying on the papers
- Most importantly: ONE large central sheet of paper, slightly crumpled, prominently lit. On it — handwritten in thick orange marker: "ОТВЕТСТВЕННЫЙ: ___" with a long blank underline after it. The blank line is empty — nobody has been named. This is the visual focal point.
- Around that central sheet: other papers with words like "обсудили", "решили", "договорились" barely readable in the shadows
- An empty coffee cup on the edge

ATMOSPHERE: Post-meeting emptiness. The decision was made but nobody owns it. The blank line after "ОТВЕТСТВЕННЫЙ:" tells the whole story. Slight chaos of papers but the central sheet is clean and stark.

LIGHTING: Single warm amber spotlight from above, illuminating the central paper with "ОТВЕТСТВЕННЫЙ: ___". Everything else — the table edges, chairs in background, walls — in deep shadow. Cinematic chiaroscuro.

MOOD: Corporate urgency mixed with institutional failure. The moment after everyone agreed but nobody was named responsible. Silent, heavy.

STYLE: Ultra-realistic photography. Dark table surface reflects subtle orange light. No people. Shot from slightly above at 35-40 degrees. Shallow depth of field — central paper sharp, surroundings slightly blurred.`;

console.log("🎨 Генерирую фон для поста #2...");
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
