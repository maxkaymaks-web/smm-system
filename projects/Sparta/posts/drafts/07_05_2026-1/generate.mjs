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

const prompt = `Highly detailed vertical social media illustration, premium luxury style, 9:16 format.

BACKGROUND: Deep dark navy-blue background with brushed metal texture — subtle horizontal grain like polished titanium, very dark, almost black with cold blue undertones. Soft geometric light reflections on the floor forming diamond and hexagonal patterns.

CENTER — MAIN ELEMENT: Monumental futuristic golden Spartan warrior helmet (ancient Greek Corinthian helmet style), front-facing, centered and dominant. The helmet is semi-transparent and constructed from glowing golden neural network lines — interconnected nodes and edges forming the helmet's surface, like a startup ecosystem map or circuit schematic. Inside the helmet, visible through the translucent mesh: a floating 3D bar chart growth graph rising steeply, glowing amber-gold, suggesting an accelerator program trajectory.

BOTTOM: A black polished marble pedestal below the helmet. Standing on it — miniature photorealistic business figures in dark suits, 4-5 people, viewed from slightly above. They examine holographic schemes and a glowing tablet displaying the text "НПТЛ · ПРИОРИТЕТ 2030" in clean white sans-serif.

LEFT: A stylized Ionic column rendered in dark stone, its capital replaced by a glowing monitor screen showing the text "Технологическое лидерство" in Russian, bright amber glow.

RIGHT: Floating golden gears of different sizes, interlocked, and a glowing diploma/scroll symbol above them, representing education and science.

LIGHTING: Cinematic softbox lighting from above, strong rim lighting on the helmet edges creating golden halos, dramatic shadows below. Floor has soft specular reflections of geometric shapes labeled "стратсессия", "акселератор", "тренинг" — subtle, almost hidden in the floor texture.

COLOR PALETTE: Deep navy #0A0E1A background, gold #C9A84C and amber #E8840A for glowing elements, cold white highlights on metal surfaces, subtle orange rim light.

STYLE: Ultra-realistic CGI render, 8K quality, octane render look, luxury brand aesthetic, cinematic composition, no text overlays except those on the in-scene screens.`;

console.log("🎨 Генерирую изображение для НПТЛ поста...");

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
