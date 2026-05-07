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

// Подвал карточки
const CARD_FOOTER = `Bottom row of card — three items spaced evenly in one row:
  [credit card emoji]          [shopping bags emoji]         [truck emoji]
  "Любой способ оплаты"        "Рассрочка"                   "Бесплатная доставка"
  (white Russian Cyrillic, small text under each icon)`;

// iPhone блок — все три телефона полностью в кадре, одинаковая позиция
// Экран CENTER телефона — ТОЛЬКО одно слово, белым на тёмном фоне
const IPHONE_RULE = `BOTTOM SECTION — three iPhones, identical layout on all slides in this series:
- All three phones placed in the lower 35% of the image, centered as a group, COMPLETELY FULLY VISIBLE — not cropped, not cut off at the bottom or sides
- Clear visible gap between each phone, phones do not touch each other
- All three phones tilted at 30 degrees to the right diagonal
- LEFT phone: iPhone 15 Pro in Black Titanium, showing the BACK of the phone, full phone visible
- CENTER phone: iPhone 15 Pro in Blue Titanium, showing the FRONT screen, full phone visible. The screen shows ONLY: a plain very dark navy background, and in the upper portion of the screen one single Russian word "НАСТРОЙКИ" written in clean white sans-serif Latin-style letters — just this one word, nothing else, no other text, no icons, no lines, no symbols, no UI elements. The word must be clearly readable Russian Cyrillic: Н-А-С-Т-Р-О-Й-К-И.
- RIGHT phone: iPhone 15 Pro in White Titanium, showing the BACK of the phone, full phone visible
All three phones are photorealistic 3D product renders. All phones are completely inside the image frame.`;

const slides = [
  {
    name: "slide2_battery_faceid",
    prompt: `Apple resale store checklist poster, vertical 9:16 format.

BACKGROUND: Deep midnight navy base. Electric blue gradients in multiple areas — NOT a single center circle. Blue flows as: (1) electric-blue from lower-left corner, (2) diagonal deep-blue streak from right side going up-left, (3) faint cyan along upper-left edge. No round vignette. Clean dark navy at top-center.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Large dark semi-transparent rounded rectangle card
- Two clearly separated blocks inside the card, all text white Russian Cyrillic:

BLOCK 1 — battery emoji + bold white uppercase Russian: "БАТАРЕЯ"
  Row with blue checkmark ✓: "Настройки → Аккумулятор → Состояние"
  Row with blue checkmark ✓: "Норма: 80% и выше"
  Row with red X ✗: "Ниже 80% — скоро замена"

BLOCK 2 — face ID emoji + bold white uppercase Russian: "FACE ID"
  Row with blue checkmark ✓: "Настройки → Face ID и код"
  Row with blue checkmark ✓: "Добавьте лицо заново — проверьте"
  Row with red X ✗: "Сбоит или не срабатывает — датчик сломан"

${CARD_FOOTER}

${IPHONE_RULE}

Style: dark premium tech checklist poster, minimal, clean. All Russian Cyrillic text perfectly readable.`
  },
  {
    name: "slide3_imei_cta",
    prompt: `Apple resale store IMEI and CTA poster, vertical 9:16 format.

BACKGROUND: Deep midnight navy base. Electric blue and cyan gradients — NOT a circular vignette. Blue appears as: (1) electric-blue in lower-right corner, (2) diagonal steel-blue from bottom-left going up-right, (3) subtle cyan along left edge. Clean dark navy at center-top.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900 — SAME SIZE as all other slides
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Dark semi-transparent rounded rectangle card, background gradient slightly visible through

BLOCK — signal emoji + bold white uppercase Russian: "IMEI — ЧИСТОТА ТЕЛЕФОНА"
  Step 1: "Наберите *#06# — запишите номер"
  Step 2: "Проверьте на сайте imei.info"
  Step 3: "Телефон не должен быть заблокирован"

Thin horizontal divider line.

Green checkmark + bold white Russian: "У нас в Black Apple"
Smaller white Russian text: "Все б/у iPhone проверены — батарея, Face ID, IMEI"

Blue rounded button with bold white Russian text: "Смотреть б/у в наличии →"
Small muted white text below: "vk.me/blackapplemsk"

${CARD_FOOTER}

${IPHONE_RULE}

Style: dark premium tech CTA poster, minimal, clean. All Russian Cyrillic text perfectly readable.`
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
