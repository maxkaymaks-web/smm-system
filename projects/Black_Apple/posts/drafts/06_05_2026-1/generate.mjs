import { fal } from "@fal-ai/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Настраиваем прокси для Node.js fetch (undici)
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
  // Используем fetch (через прокси undici)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} при скачивании`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  return dest;
}

// Общее описание фона — НЕ круг в центре, а паттерн из нескольких источников по всему изображению
const BG = `BACKGROUND (critical): Deep near-black base. Rich crimson-red and dark burgundy gradients are spread across multiple areas of the entire image creating an abstract pattern — NOT a single round spotlight in the center. The red gradients flow as: (1) a strong warm crimson glow bleeding in from the lower-left corner, (2) a diagonal deep-red streak cutting from the bottom-right upward, (3) a subtle dark-red shimmer along the upper-right edge, (4) a faint burgundy haze across the center-right. The overall effect is like dark velvet with multiple red light sources, abstract and dynamic. No circular vignette in the center. The black background in the center-top stays clean and dark.`;

// Стандартная шапка — одинаковый размер и позиция на всех 3 слайдах
const HEADER = `TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered, occupying the very top portion of the image, font weight 900, massive letters
- Directly below: "магазин техники" in regular weight small white Russian Cyrillic text, centered, same vertical gap as all other slides`;

// Подвал карточки — одинаковый на всех слайдах
const CARD_FOOTER = `Bottom row of card — three items spaced evenly in one row:
  [credit card emoji]          [shopping bags emoji]         [red truck emoji]
  "Любой способ оплаты"        "Рассрочка"                   "Бесплатная доставка"
  (white Russian Cyrillic, small text under each icon)`;

const slides = [
  {
    name: "slide1_cover",
    iphones: `BOTTOM SECTION — three iPhones standing upright with VISIBLE GAPS between them (not touching), slightly tilted in 3D perspective:
- LEFT: iPhone 17 in warm Gold color, showing the back camera
- CENTER: iPhone 17 in Deep Black, screen facing forward with a portrait wallpaper
- RIGHT: iPhone 17 in Teal/Mint color, showing the back camera
Each phone has clear empty space on both sides. They are partially cut off by the bottom edge. Photo-realistic renders.`,
    prompt: `Apple tech store promotional poster, vertical 9:16 format.

BACKGROUND (critical): Deep near-black base. Rich crimson-red and dark burgundy gradients are spread across multiple areas creating an abstract pattern — NOT a single round spotlight in the center. The red gradients flow as: (1) strong crimson glow from the lower-left corner, (2) diagonal deep-red streak from bottom-right upward, (3) subtle dark-red along the upper-right edge. Abstract and dynamic, like dark velvet with multiple red light sources. No circular vignette in center. Black stays clean at center-top.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Dark semi-transparent rounded rectangle card, slightly transparent so background shows through edges
- Inside the card, centered white bold Russian Cyrillic heading: "iPhone 17 — КАТАЛОГ МАЯ"
- Below: white Russian Cyrillic text "Новые и б/у модели в наличии"
- ${CARD_FOOTER}

BOTTOM SECTION — three iPhones standing upright with VISIBLE GAPS between them (NOT touching or overlapping):
- LEFT: iPhone 17 in warm Gold, showing back camera, slightly tilted
- CENTER: iPhone 17 in Deep Black, screen facing forward with portrait wallpaper
- RIGHT: iPhone 17 in Teal/Mint, showing back camera, slightly tilted
Partially cut off by bottom edge. Photo-realistic 3D renders. Clear gap between each phone.

Style: luxury premium dark tech store poster, minimal, no clip art.`
  },
  {
    name: "slide2_price",
    prompt: `Apple tech store price list poster, vertical 9:16 format.

BACKGROUND (critical): Deep near-black base. Rich crimson-red gradients across multiple areas — NOT a single center circle. Red flows: (1) from bottom-left corner strongly, (2) diagonal burgundy streak from right side going up-left, (3) faint dark-red along upper-left edge. Multiple gradient sources creating dynamic abstract dark-red pattern. No round vignette. Clean black at top-center.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Large dark semi-transparent rounded rectangle card
- Card header centered white bold: "IPHONE 17 НОВЫЕ"
- Price table inside card, white text, three clearly aligned columns:
  "17             128 GB        от 89 990 ₽"
  "17             256 GB        от 99 990 ₽"
  [divider line]
  "17 Plus       256 GB        от 109 990 ₽"
  "17 Plus       512 GB        от 119 990 ₽"
  [divider line]
  "17 Pro         256 GB        от 129 990 ₽"
  "17 Pro         512 GB        от 144 990 ₽"
  [divider line]
  "17 Pro Max   256 GB        от 149 990 ₽"
  "17 Pro Max   512 GB        от 164 990 ₽"
- ${CARD_FOOTER}

BOTTOM SECTION — three iPhones standing upright with VISIBLE GAPS between them (NOT touching):
- LEFT: iPhone 17 Pro in Desert Titanium, showing back with triple cameras, slightly tilted
- CENTER: iPhone 17 Pro in Black Titanium, screen facing forward with dark wallpaper
- RIGHT: iPhone 17 Pro in White Titanium, showing back, slightly tilted
Partially cut off by bottom edge. Photo-realistic 3D renders. Clear gap between each phone.

Style: luxury premium dark tech store poster, minimal, clean typography.`
  },
  {
    name: "slide3_benefits",
    prompt: `Apple tech store advantages poster, vertical 9:16 format.

BACKGROUND (critical): Deep near-black base. Rich crimson-red gradients spread across different parts of the image as an abstract pattern — NOT a circular dark blob or vignette in the center. The red appears as: (1) warm crimson glow in the lower-right corner, (2) a diagonal burgundy streak from bottom-left going up-right, (3) subtle dark red along the left edge mid-way. The center-top of the background must be clean dark black without any dark blob or circle. Multiple gradient light sources across the image, dynamic and asymmetric.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900 — SAME SIZE as the other two slides
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered — SAME SIZE and position as other slides

MIDDLE SECTION:
- Dark semi-transparent rounded rectangle card, NOT fully opaque — background gradient slightly visible through edges
- Card heading in white bold Russian Cyrillic uppercase: "ПОЧЕМУ ВЫБИРАЮТ НАС"
- Four benefit rows, each with a green checkmark emoji and white Russian Cyrillic text:
  ✅ "Гарантия до 1 года на всю технику"
  ✅ "Рассрочка — без переплат"
  ✅ "Трейд-ин — сдайте старый, получите новый"
  ✅ "Доставка по Москве в день заказа"
- Below benefits, white Russian Cyrillic: "Напишите нам: vk.me/blackapplemsk"
- ${CARD_FOOTER}

BOTTOM SECTION — three iPhones standing upright with VISIBLE CLEAR GAPS between them (definitely NOT touching):
- LEFT: iPhone 17 in Pink/Rose color, showing back camera, slightly tilted
- CENTER: iPhone 17 in Ultramarine Blue, screen facing forward with colorful wallpaper
- RIGHT: iPhone 17 in Natural Titanium/Silver, showing back camera, slightly tilted
Partially cut off by bottom edge. Photo-realistic 3D renders. Noticeable empty space between each phone.

Style: luxury premium dark tech poster, clean, minimal.`
  }
];

const outputDir = path.join(__dirname);

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
    if (!imgUrl) {
      console.error(`❌ Нет URL для ${slide.name}`, JSON.stringify(result.data));
      continue;
    }

    const dest = path.join(outputDir, `${slide.name}.jpg`);
    await download(imgUrl, dest);
    console.log(`✅ Сохранён: ${dest}`);
  } catch (err) {
    console.error(`❌ Ошибка ${slide.name}:`, err.message || err);
  }
}

console.log("\n✅ Готово!");
