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

// iPhone блок — ТОЧНО как слайд 1: правая диагональ, полностью в кадре
// Экран CENTER: iOS Настройки на русском языке
const IPHONE_RULE = `BOTTOM SECTION — three iPhones in identical layout as slide 1 of this series:
POSITION: lower third of the image, all three fully visible inside the frame, not cropped.
TILT: all three phones angled to the RIGHT diagonal — the right edge of each phone is closer to the viewer, the left edge recedes away. This is a classic 3D product shot from a slightly elevated left-front viewpoint. Same exact perspective angle as slide 1.
SPACING: clear visible gap between each phone, they do not touch.

- LEFT phone: iPhone 15 Pro in Black Titanium — showing the BACK of the phone, right-diagonal tilt, triple camera visible, full phone in frame
- CENTER phone: iPhone 15 Pro in Blue Titanium — showing the FRONT screen, right-diagonal tilt, full phone in frame.
  SCREEN CONTENT (critical): the screen displays the Apple iOS Settings app in RUSSIAN language, light grey iOS background.
  The screen shows a vertical list of Russian settings menu items in standard iOS style — dark grey text on light background, each item separated by a thin line:
  "Основные"
  "Аккумулятор"
  "Режим питания"
  "Face ID и код"
  "Зарядка"
  All text is in Russian Cyrillic only. Clean iOS list design. NO random symbols. NO hieroglyphs. NO Latin letters on the screen.
- RIGHT phone: iPhone 15 Pro in White Titanium — showing the BACK of the phone, right-diagonal tilt, camera bump visible, full phone in frame

All three phones are photorealistic 3D product renders with clean reflective surfaces. All completely inside image boundaries.`;

const slides = [
  {
    name: "slide2_battery_faceid",
    prompt: `Apple resale store checklist poster, vertical 9:16 format.

BACKGROUND: Deep midnight navy base. Electric blue gradients in multiple areas — NOT a center circle. Blue flows as: (1) electric-blue from lower-left corner, (2) diagonal deep-blue streak from right going up-left, (3) faint cyan along upper-left edge. No round vignette. Clean dark navy at top-center.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Large dark semi-transparent rounded rectangle card, all text white Russian Cyrillic:

BLOCK 1 — battery emoji + bold white uppercase: "БАТАРЕЯ"
  ✓ blue checkmark: "Настройки → Аккумулятор → Состояние"
  ✓ blue checkmark: "Норма: 80% и выше"
  ✗ red X: "Ниже 80% — скоро нужна замена"

BLOCK 2 — face emoji + bold white uppercase: "FACE ID"
  ✓ blue checkmark: "Настройки → Face ID и код"
  ✓ blue checkmark: "Добавьте лицо заново и проверьте"
  ✗ red X: "Сбоит или не срабатывает — датчик сломан"

${CARD_FOOTER}

${IPHONE_RULE}

Style: dark premium tech checklist poster, minimal, clean.`
  },
  {
    name: "slide3_imei_cta",
    prompt: `Apple resale store IMEI check and CTA poster, vertical 9:16 format.

BACKGROUND: Deep midnight navy base. Electric blue and cyan gradients — NOT a circular vignette. Blue appears as: (1) electric-blue in lower-right corner, (2) diagonal steel-blue from bottom-left going up-right, (3) subtle cyan along left edge. Clean dark navy at center-top.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900 — SAME SIZE as all other slides
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

${IPHONE_RULE}

Style: dark premium tech CTA poster, minimal, clean.`
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
