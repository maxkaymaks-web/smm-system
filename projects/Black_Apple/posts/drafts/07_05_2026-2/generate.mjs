import { fal } from "@fal-ai/client";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Прокси для Node.js fetch (undici)
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

// Фон — тёмно-синий, НЕ круг в центре
const BG = `BACKGROUND (critical): Deep near-black midnight navy base. Electric blue and deep steel-blue gradients spread across multiple areas of the image — NOT a single round spotlight in the center. The blue gradients flow as: (1) a strong electric-blue glow bleeding in from the lower-left corner, (2) a diagonal deep-steel-blue streak cutting from the bottom-right upward toward center-left, (3) a subtle cyan shimmer along the upper-right edge, (4) a faint dark-navy haze across center-right. The overall effect is like a dark night sky with multiple blue light sources, abstract and dynamic. No circular vignette. The center-top stays clean and very dark navy.`;

// Шапка — одинаковая на всех слайдах
const HEADER = `TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered, same vertical gap as all other slides`;

// Подвал карточки — одинаковый на всех слайдах
const CARD_FOOTER = `Bottom row of card — three items spaced evenly in one row:
  [credit card emoji]          [shopping bags emoji]         [truck emoji]
  "Любой способ оплаты"        "Рассрочка"                   "Бесплатная доставка"
  (white Russian Cyrillic, small text under each icon)`;

// Правило iPhone — одинаковое на всех слайдах (единое положение, полностью видны, читаемый экран)
const IPHONE_RULE = `BOTTOM SECTION — three iPhones arranged in a fixed identical layout (same position on ALL slides in this series):
LAYOUT: all three phones placed in the lower 35% of the image, centered horizontally as a group, FULLY VISIBLE from top to bottom — NOT cropped, NOT cut off by edges. All phones are fully inside the frame.
ARRANGEMENT: three phones side by side with a clear visible gap between each phone (not touching).
TILT: all three phones tilted at 30–35 degrees to the right diagonal, viewed from slightly left-front angle.
- LEFT phone: iPhone 15 in Deep Black, back panel facing viewer, camera bump visible, full phone in frame
- CENTER phone: iPhone 15 in Blue color, screen facing viewer, screen shows the iOS Settings app in RUSSIAN language — clean readable white Russian text: "Настройки" as the app title, list items "Основные", "Аккумулятор", "Face ID и код" in clear Russian Cyrillic — NO random symbols, NO hieroglyphs, NO unreadable glyphs
- RIGHT phone: iPhone 15 in Silver/White, back panel facing viewer, camera bump visible, full phone in frame
All three phones are completely inside the image boundaries. Photo-realistic 3D product renders. Clean reflective surfaces.`;

const slides = [
  {
    name: "slide1_cover",
    prompt: `Apple resale store informational poster, vertical 9:16 format.

BACKGROUND (critical): Deep near-black midnight navy base. Electric blue and deep steel-blue gradients spread across multiple areas — NOT a single center spotlight. Blue gradients flow as: (1) strong electric-blue glow from the lower-left corner, (2) diagonal steel-blue streak from bottom-right going up-left, (3) subtle cyan shimmer along the upper-right edge. Abstract and dynamic, like a dark night sky with multiple blue light sources. No circular vignette in center. Very dark navy at center-top.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Dark semi-transparent rounded rectangle card, slightly transparent so background shows through edges
- Inside card, centered white bold Russian Cyrillic large heading: "КАК ПРОВЕРИТЬ Б/У iPHONE"
- Below heading in white regular smaller text: "Батарея · Face ID · IMEI"
- Below that in white muted smaller text: "Займёт 5 минут — сохраните"
- Three icons in a row with labels below: [battery emoji] "Батарея" · [face emoji] "Face ID" · [signal emoji] "IMEI"
- ${CARD_FOOTER}

${IPHONE_RULE}

Style: dark premium tech store poster, minimal, clean, no clip art.`
  },
  {
    name: "slide2_battery_faceid",
    prompt: `Apple resale store checklist poster, vertical 9:16 format.

BACKGROUND (critical): Deep midnight navy base. Electric blue gradients in multiple areas — NOT a center circle. Blue flows as: (1) electric-blue from lower-left corner strongly, (2) diagonal deep-blue streak from right side going up-left, (3) faint cyan along upper-left edge. Multiple gradient sources, dynamic abstract dark-blue pattern. No round vignette. Clean dark navy at top-center.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered

MIDDLE SECTION:
- Large dark semi-transparent rounded rectangle card
- Two clearly separated checklist blocks inside:

BLOCK 1 — battery emoji + bold white Russian uppercase: "БАТАРЕЯ"
  Checklist item with blue checkmark: "Настройки → Аккумулятор → Состояние"
  Checklist item with blue checkmark: "Должно быть 80% и выше"
  Checklist item with red X: "Ниже 80% — скоро нужна замена"

BLOCK 2 — face emoji + bold white Russian uppercase: "FACE ID"
  Checklist item with blue checkmark: "Настройки → Face ID и код"
  Checklist item with blue checkmark: "Попробуйте добавить лицо заново"
  Checklist item with red X: "Сбоит или не срабатывает — проблема с датчиком"

All text in white Russian Cyrillic, clear and readable.
- ${CARD_FOOTER}

${IPHONE_RULE}

Style: dark premium tech checklist poster, minimal, clean typography.`
  },
  {
    name: "slide3_imei_cta",
    prompt: `Apple resale store IMEI check and call-to-action poster, vertical 9:16 format.

BACKGROUND (critical): Deep midnight navy base. Electric blue and cyan gradients spread across different parts — NOT a circular dark blob or vignette in center. Blue appears as: (1) electric-blue glow in lower-right corner, (2) diagonal steel-blue streak from bottom-left going up-right, (3) subtle cyan shimmer along left edge mid-way. Center-top must be clean dark navy without any dark blob or circle. Multiple gradient sources, asymmetric and dynamic.

TOP SECTION — identical size and position on all slides in this series:
- "BLACK APPLE" in extra-large heavy bold uppercase white sans-serif text, centered at top, massive letters, font weight 900 — SAME SIZE as the other two slides
- Directly below: "магазин техники" in small regular white Russian Cyrillic, centered — SAME SIZE and position as other slides

MIDDLE SECTION:
- Dark semi-transparent rounded rectangle card, NOT fully opaque — background gradient slightly visible through edges

BLOCK — signal emoji + bold white Russian uppercase: "IMEI — ЧИСТОТА ТЕЛЕФОНА"
  Step with number 1: "Наберите *#06# — запишите номер"
  Step with number 2: "Проверьте на imei.info или Apple"
  Step with number 3: "Телефон не должен быть заблокирован"

Thin horizontal divider line.

Green checkmark emoji + bold white Russian text: "У нас в Black Apple"
Regular white smaller Russian text: "Все б/у iPhone проходят проверку перед продажей — батарея, Face ID, IMEI. Продаём только то, за что не стыдно."

Below: blue rounded button shape with white bold Russian text: "Смотреть б/у в наличии →"
Below button small white muted text: "vk.me/blackapplemsk"

- ${CARD_FOOTER}

${IPHONE_RULE}

Style: dark premium tech store CTA poster, minimal, clean.`
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
