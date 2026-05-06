import { fal } from "@fal-ai/client";
import https from "https";
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

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (r) => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(dest); });
    }).on("error", reject);
  });
}

const BG = `Background: deep black at the very top and side edges, transitioning into a rich vivid saturated crimson-red radial glow emanating from the lower-center area of the image, like a warm red theater spotlight or fire glow from below — the red is intense, deep, warm, and gradually fades to pure black towards the corners and top. This dark-red gradient background is the dominant visual element.`;

const IPHONES = `At the very bottom of the image: three iPhone 17 smartphones displayed side by side in a slight 3D perspective tilt — one in warm gold/titanium color on the left, one in space black in the center (screen facing forward showing a portrait photo wallpaper), one in natural green on the right. Photo-realistic 3D renders, slightly overlapping, partially cut off by the bottom edge.`;

const slides = [
  {
    name: "slide1_cover",
    prompt: `Apple tech store promotional poster, vertical 9:16 format.

${BG}

TOP SECTION — white text on dark background:
- Very large bold uppercase latin text "BLACK APPLE" centered at top (huge, heavy weight, white)
- Below it in smaller regular white Russian Cyrillic: "магазин техники"

MIDDLE SECTION:
- Large dark semi-transparent rounded rectangle card in the center
- Inside the card, centered white Russian Cyrillic bold heading: "iPhone 17 — КАТАЛОГ МАЯ"
- Below: white Russian Cyrillic text "Новые и б/у модели в наличии"
- Bottom of card: three small emoji icons spaced evenly — credit card emoji, shopping bags emoji, red truck emoji — with Russian Cyrillic labels underneath: "Любой способ оплаты", "Рассрочка", "Бесплатная доставка"

${IPHONES}

Style: luxury premium tech store, minimal, clean, no clipart borders, no decorative elements except the gradient.`
  },
  {
    name: "slide2_price",
    prompt: `Apple tech store price list poster, vertical 9:16 format.

${BG}

TOP SECTION — white text on dark background:
- Very large bold uppercase latin text "BLACK APPLE" centered at top
- Below: smaller regular white Russian Cyrillic text "магазин техники"

MIDDLE SECTION:
- Large dark semi-transparent rounded rectangle card occupying most of the center
- Card header in white: "IPHONE 17 НОВЫЕ"
- Inside card, clean white Cyrillic and numeric text in three columns (left: model name, center: storage, right: price):
  "17          128 GB       от 89 990 ₽"
  "17          256 GB       от 99 990 ₽"
  (blank line)
  "17 Plus    256 GB       от 109 990 ₽"
  "17 Plus    512 GB       от 119 990 ₽"
  (blank line)
  "17 Pro     256 GB       от 129 990 ₽"
  "17 Pro     512 GB       от 144 990 ₽"
  (blank line)
  "17 Pro Max 256 GB      от 149 990 ₽"
  "17 Pro Max 512 GB      от 164 990 ₽"
- Bottom of card: three small emoji icons — credit card, shopping bags, truck — with Russian Cyrillic captions: "Любой способ оплаты", "Рассрочка", "Бесплатная доставка"

${IPHONES}

Style: luxury premium dark tech store poster, minimal, no borders, clean typography.`
  },
  {
    name: "slide3_benefits",
    prompt: `Apple tech store advantages poster, vertical 9:16 format.

${BG}

TOP SECTION — white text on dark background:
- Very large bold uppercase latin text "BLACK APPLE" centered at top
- Below: smaller regular white Russian Cyrillic text "магазин техники"

MIDDLE SECTION:
- Large dark semi-transparent rounded rectangle card in center
- Card heading in white bold Russian Cyrillic: "ПОЧЕМУ ВЫБИРАЮТ НАС"
- Four benefit rows with green checkmark icons, white Russian Cyrillic text:
  ✓ "Гарантия до 1 года на всю технику"
  ✓ "Рассрочка — без переплат"
  ✓ "Трейд-ин — сдайте старый, получите новый"
  ✓ "Доставка по Москве в день заказа"
- Below benefits: white Russian Cyrillic text "Напишите нам: vk.me/blackapplemsk"
- Bottom of card: three small emoji icons — credit card, shopping bags, truck — with Russian Cyrillic captions: "Любой способ оплаты", "Рассрочка", "Бесплатная доставка"

${IPHONES}

Style: luxury premium dark tech poster, clean, minimal, no clip art.`
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
