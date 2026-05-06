import { fal } from "@fal-ai/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envContent = fs.readFileSync(
  path.join(process.env.USERPROFILE || process.env.HOME, ".claude", ".env.fal"),
  "utf-8"
);
const falKey = envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim();
fal.config({ credentials: falKey });

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "http://127.0.0.1:10809";
setGlobalDispatcher(new ProxyAgent(proxyUrl));
console.log(`🔗 Прокси: ${proxyUrl}`);

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  return dest;
}

// Точное описание айфонов — как на слайде 3 (там получилось правильно)
// LEFT = спиной, чуть наклонён влево
// CENTER = экраном к зрителю, прямо
// RIGHT = спиной, чуть наклонён вправо
// Между каждым — видимый зазор, телефоны НЕ касаются друг друга

const IPHONE_LAYOUT = (left, center, right) => `
BOTTOM OF IMAGE — three iPhones arranged exactly like this:
- They stand upright in a row with a CLEAR VISIBLE GAP between each phone (phones do NOT touch or overlap)
- LEFT phone: ${left} — showing the BACK of the phone with camera, body tilted slightly to the LEFT away from center
- CENTER phone: ${center} — screen facing DIRECTLY toward the viewer, upright, no tilt
- RIGHT phone: ${right} — showing the BACK of the phone with camera, body tilted slightly to the RIGHT away from center
- All three phones are the same height
- They are partially cropped by the bottom edge of the image
- Photo-realistic 3D renders, same lighting as the background`;

const BG_1 = `BACKGROUND: Deep near-black base. Rich crimson-red gradient flows diagonally from the upper-right corner downward, and another red glow comes in from the lower-left. Multiple angular red streaks across the image — NOT a single circle. Clean dark black in the center-top area.`;

const BG_2 = `BACKGROUND: Deep near-black base. Dark crimson-red gradient bleeds in strongly from the right side as diagonal angular streaks, and a warm red glow in the lower-left corner. The red patterns are spread across multiple areas asymmetrically. Clean dark area in the upper-left.`;

const HEADER = `TOP: "BLACK APPLE" in extra-large heavy bold white uppercase latin text, centered. Below it: "магазин техники" in small regular white Russian Cyrillic text, centered.`;

const FOOTER = `Bottom row inside card — three equally spaced items:
[credit card emoji] "Любой способ оплаты" | [shopping bags emoji] "Рассрочка" | [red truck emoji] "Бесплатная доставка"
(white Russian Cyrillic labels under each emoji)`;

const slides = [
  {
    name: "slide1_cover",
    prompt: `Apple tech store poster, vertical 9:16.

${BG_1}

${HEADER}

MIDDLE: dark semi-transparent rounded rectangle card.
Inside card:
- Bold white Russian/Latin: "iPhone 17 — КАТАЛОГ МАЯ"
- Regular white Russian: "Новые и б/у модели в наличии"
- ${FOOTER}

${IPHONE_LAYOUT(
  "iPhone 17 in warm Gold color",
  "iPhone 17 in Deep Black with a portrait photo on screen",
  "iPhone 17 in Teal/Mint color"
)}

Style: luxury dark premium tech poster, minimal.`
  },
  {
    name: "slide2_price",
    prompt: `Apple tech store price list poster, vertical 9:16.

${BG_2}

${HEADER}

MIDDLE: large dark semi-transparent rounded rectangle card.
Card header: "IPHONE 17 НОВЫЕ" (white bold)
Price table (white text, three columns — model | storage | price):
  17          | 128 GB | от 89 990 ₽
  17          | 256 GB | от 99 990 ₽
  ─────────────────────────────────
  17 Plus   | 256 GB | от 109 990 ₽
  17 Plus   | 512 GB | от 119 990 ₽
  ─────────────────────────────────
  17 Pro     | 256 GB | от 129 990 ₽
  17 Pro     | 512 GB | от 144 990 ₽
  ─────────────────────────────────
  17 Pro Max | 256 GB | от 149 990 ₽
  17 Pro Max | 512 GB | от 164 990 ₽
${FOOTER}

${IPHONE_LAYOUT(
  "iPhone 17 Pro in Desert Titanium (warm beige-gold)",
  "iPhone 17 Pro in Black Titanium with a dark wallpaper on screen",
  "iPhone 17 Pro in White/Natural Titanium — BACK of the phone visible, camera block facing viewer, tilted to the RIGHT"
)}

Style: luxury dark premium tech poster, minimal, clean typography.`
  }
];

for (const slide of slides) {
  console.log(`\n🎨 Генерирую: ${slide.name}...`);
  try {
    const result = await fal.run("fal-ai/nano-banana-2", {
      input: {
        prompt: slide.prompt,
        aspect_ratio: "9:16",
        resolution: "2K",
        output_format: "jpeg",
        thinking_level: "high",
      },
    });

    const imgUrl = result.data?.images?.[0]?.url;
    if (!imgUrl) { console.error("❌ нет URL", result.data); continue; }

    const dest = path.join(__dirname, `${slide.name}.jpg`);
    await download(imgUrl, dest);
    console.log(`✅ ${dest}`);
  } catch (err) {
    console.error(`❌ ${slide.name}:`, err.message);
  }
}

console.log("\n✅ Готово!");
