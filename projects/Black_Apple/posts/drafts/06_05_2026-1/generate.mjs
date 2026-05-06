import { fal } from "@fal-ai/client";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load FAL key
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

const slides = [
  {
    name: "slide1_cover",
    prompt: `Premium Apple tech store advertisement poster, vertical format. Brand name "BLACK APPLE" in large bold white sans-serif uppercase letters at top center, small subtitle "магазин техники" below it. Deep black background with vivid crimson red radial glow/gradient emanating from the center-left area, dramatic cinematic lighting. Center: dark semi-transparent rounded rectangle card with white text "IPHONE 17 — КАТАЛОГ МАЯ" in clean uppercase. Bottom half: three iPhone 17 smartphones displayed side by side in 3D perspective — titanium, black and natural titanium colors, photo-realistic renders. Bottom of card: small icons for credit card, shopping bag and delivery truck with labels. Luxury minimalist tech advertisement, no borders, no clipart, premium dark aesthetic. 9:16 vertical`
  },
  {
    name: "slide2_price",
    prompt: `Premium Apple store price list poster, vertical format. Brand name "BLACK APPLE" bold white uppercase at top, subtitle "магазин техники". Deep black background with dark crimson red radial glow from center, dramatic moody lighting. Center: large dark rounded rectangle card with white text listing iPhone models and prices: "IPHONE 17 НОВЫЕ" as header, then rows: "17  128 GB  от 89 990 ₽", "17  256 GB  от 99 990 ₽", "17 Plus  256 GB  от 109 990 ₽", "17 Pro  256 GB  от 119 990 ₽", "17 Pro Max  256 GB  от 129 990 ₽". Clean monospaced white text, neat table layout. Bottom of card: three icons — credit card, shopping bags, delivery truck with captions "Любой способ оплаты", "Рассрочка", "Бесплатная доставка". Two iPhone 17 renders peeking at very bottom. Luxury dark premium tech poster aesthetic. 9:16 vertical`
  },
  {
    name: "slide3_benefits",
    prompt: `Premium Apple tech store benefits poster, vertical format. Brand name "BLACK APPLE" bold white uppercase at top, "магазин техники" subtitle. Deep black background with rich crimson red radial glow, luxury moody atmosphere. Center: dark rounded rectangle card, white heading "ПОЧЕМУ ВЫБИРАЮТ НАС", then four bullet points with checkmark icons: "Гарантия до 1 года", "Рассрочка без переплат", "Трейд-ин — сдай старый", "Доставка в день заказа". Clean minimal white text, generous spacing. Bottom: glowing Apple logo subtly embedded. Two iPhone 17 Pro models at very bottom in titanium and space black. CTA button style element "Написать нам → vk.me/blackapplemsk". Premium luxury dark tech aesthetic, no clipart. 9:16 vertical`
  }
];

const outputDir = path.join(__dirname);

for (const slide of slides) {
  console.log(`\n🎨 Генерирую: ${slide.name}...`);
  try {
    const result = await fal.run("fal-ai/ideogram/v3", {
      input: {
        prompt: slide.prompt,
        aspect_ratio: "ASPECT_9_16",
        style: "DESIGN",
        rendering_speed: "QUALITY",
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

console.log("\n✅ Генерация завершена!");
