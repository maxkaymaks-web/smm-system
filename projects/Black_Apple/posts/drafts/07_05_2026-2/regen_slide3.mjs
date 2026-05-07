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
  if (!res.ok) throw new Error(`HTTP ${res.status} при скачивании`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  return dest;
}

const CARD_FOOTER = `Bottom row of card — three items spaced evenly in one row:
  [credit card emoji]  [shopping bags emoji]  [truck emoji]
  "Любой способ оплаты"  "Рассрочка"  "Бесплатная доставка"
  (white Russian Cyrillic, small text under each icon)`;

const prompt = `Apple resale store IMEI check and CTA poster, vertical 9:16 format.

BACKGROUND: Deep midnight navy base. Electric blue and cyan gradients — NOT a circular vignette. Blue appears as: (1) electric-blue in lower-right corner, (2) diagonal steel-blue from bottom-left going up-right, (3) subtle cyan along left edge. Clean dark navy at center-top.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Dark semi-transparent rounded rectangle card, all text white Russian Cyrillic:

signal emoji + bold white uppercase: "IMEI — ЧИСТОТА ТЕЛЕФОНА"
  1. "Наберите *#06# — запишите номер"
  2. "Проверьте на сайте imei.info"
  3. "Телефон не должен быть заблокирован"

Thin horizontal divider.

✅ + bold white: "У нас в Black Apple"
Smaller white text: "Все б/у iPhone проверены — батарея, Face ID, IMEI"

Blue rounded button with bold white Russian text: "Смотреть б/у в наличии →"
Small muted white text: "vk.me/blackapplemsk"

${CARD_FOOTER}

BOTTOM SECTION — three iPhones. CRITICAL REQUIREMENT: ALL THREE phones must be rotated to the RIGHT DIAGONAL — this is a standard 3D product shot where the right side of each phone faces the viewer and the left side recedes into the background. The viewing angle is from the upper-left front. This is the same perspective as a classic Apple product render where you see the phone from a 35-degree angle to the right. All three phones lean right at the same angle, no phone is facing straight forward.

- ALL THREE phones: right-diagonal tilt at 35 degrees, right edge closer to viewer, left edge further away, viewed from slightly above and to the left
- LEFT phone: iPhone 15 Pro Black Titanium — BACK panel facing viewer at right-diagonal angle, full phone in frame, not cropped
- CENTER phone: iPhone 15 Pro Blue Titanium — FRONT screen facing viewer at right-diagonal angle (same tilt as left and right phones, screen turned toward viewer). Screen shows iOS Settings app in Russian: white background, "Настройки" title, list of rows with colored icons and Russian labels: "Основные", "Аккумулятор", "Face ID и код-пароль", "Экран и яркость", "Обои". Russian Cyrillic text only, no symbols.
- RIGHT phone: iPhone 15 Pro White Titanium — BACK panel facing viewer at right-diagonal angle, full phone in frame, not cropped

All three phones placed in the lower 35% of the image. Clear gap between each phone. All completely inside the image frame. Photorealistic 3D renders.

Style: dark premium tech CTA poster, minimal, clean.`;

console.log(`\n🎨 Генерирую: slide3_imei_cta...`);
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
    console.error(`❌ Нет URL`, JSON.stringify(result.data));
    process.exit(1);
  }

  const dest = path.join(__dirname, "slide3_imei_cta.jpg");
  await download(imgUrl, dest);
  console.log(`✅ Сохранён: ${dest}`);
} catch (err) {
  console.error(`❌ Ошибка:`, err.message || err);
}

console.log("\n✅ Готово!");
