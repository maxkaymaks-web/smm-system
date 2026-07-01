import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const W = 1080, H = 1350;
const BG = '#3F5870';
const GOLD = '#D9B36C';

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@600;700&display=swap');`;

const NICK = `
  <div style="position:absolute;right:48px;bottom:48px;z-index:12;border:1.5px solid ${GOLD};padding:11px 24px;background:rgba(20,30,40,0.22);">
    <div style="font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:#FFFFFF;font-size:26px;letter-spacing:0.03em;">Ilios Tan</div>
  </div>
`;

// жёлтые звёзды — одинаково в правом верхнем углу на всех слайдах
const CORNER_STAR = `<img class="sticker" src="star.png" style="position:absolute;z-index:9;top:-70px;right:-90px;width:300px;opacity:0.95;">`;

// доп. декор для заполнения пустых зон — золотые штрихи / мелкое конфетти
const FILL = (style, src = 'strokes.png', opacity = 0.4) => `<img class="sticker" src="${src}" style="position:absolute;z-index:2;opacity:${opacity};${style}">`;

const headline = (text, size, extra = '') => `
  <div style="text-align:center;${extra}">
    <div style="width:46px;height:1.5px;background:${GOLD};margin:0 auto 14px;"></div>
    <div style="font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:#FFFFFF;font-size:${size}px;line-height:1.18;letter-spacing:0.01em;text-shadow:0 2px 14px rgba(0,0,0,0.35);">${text}</div>
  </div>
`;

const base = (inner) => `<!doctype html><html><head><meta charset="utf-8">
<style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;overflow:hidden;background:${BG};position:relative;}
.polaroid{position:absolute;background:#FAF7EF;padding:16px;box-shadow:0 24px 50px rgba(0,0,0,0.35);z-index:4;}
.polaroid img{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(1.1) contrast(1.05) brightness(1.02);}
</style></head><body>${inner}</body></html>`;

// ---------- Slide 1: cover ----------
const PW1 = 860, PH1 = 950, PL1 = (W - PW1) / 2;
const cover = base(`
  ${CORNER_STAR}
  ${FILL(`left:18px;top:170px;width:130px;transform:rotate(-10deg);`, 'confetti.png', 0.5)}
  ${FILL(`left:6px;bottom:70px;width:160px;transform:rotate(8deg);`, 'strokes.png', 0.4)}

  <div style="position:absolute;top:70px;left:56px;right:56px;z-index:7;">
    ${headline('Наши чемпионки<br>на пьедестале почёта', 50)}
  </div>

  <div class="polaroid" style="width:${PW1}px;height:${PH1}px;left:${PL1}px;top:290px;transform:rotate(-1deg);">
    <img src="src2.jpg" style="object-position:center 26%;">
  </div>

  ${NICK}
`);

// ---------- Slide 2: src1 winner on podium ----------
const PW2 = 920, PH2 = 950, PL2 = (W - PW2) / 2;
const slide2 = base(`
  ${CORNER_STAR}
  ${FILL(`right:6px;top:250px;width:120px;transform:rotate(-12deg);`, 'confetti.png', 0.5)}
  ${FILL(`left:4px;bottom:60px;width:150px;transform:rotate(7deg);`, 'strokes.png', 0.4)}

  <div class="polaroid" style="width:${PW2}px;height:${PH2}px;left:${PL2}px;top:60px;transform:rotate(-0.8deg);">
    <img src="src1.jpg" style="object-position:center 20%;">
  </div>

  <div style="position:absolute;left:56px;right:56px;top:1075px;z-index:7;">
    ${headline('Победа —<br>безупречный загар', 44)}
  </div>

  ${NICK}
`);

// ---------- Slide 3: src2 team photo ----------
const PW3 = 840, PH3 = 850, PL3 = (W - PW3) / 2;
const slide3 = base(`
  ${CORNER_STAR}
  ${FILL(`right:30px;top:190px;width:120px;transform:rotate(-8deg);`, 'confetti.png', 0.5)}
  ${FILL(`left:24px;top:940px;width:150px;transform:rotate(5deg);`, 'strokes.png', 0.4)}

  <div style="position:absolute;top:70px;left:56px;right:56px;z-index:7;">
    ${headline('Самые яркие<br>и роскошные', 48)}
  </div>

  <div class="polaroid" style="width:${PW3}px;height:${PH3}px;left:${PL3}px;top:230px;transform:rotate(1deg);">
    <img src="src2.jpg" style="object-position:center 30%;">
  </div>

  <div style="position:absolute;left:56px;right:56px;top:1150px;z-index:7;">
    ${headline('Команда чемпионок в Pearl', 38)}
  </div>

  ${NICK}
`);

// ---------- Slide 4: src3 close-up ----------
const PW4 = 880, PH4 = 990, PL4 = (W - PW4) / 2;
const slide4 = base(`
  ${CORNER_STAR}
  ${FILL(`left:12px;top:260px;width:115px;transform:rotate(-8deg);`, 'confetti.png', 0.5)}
  ${FILL(`left:10px;bottom:130px;width:145px;transform:rotate(6deg);`, 'strokes.png', 0.4)}

  <div class="polaroid" style="width:${PW4}px;height:${PH4}px;left:${PL4}px;top:50px;transform:rotate(-0.6deg);">
    <img src="src3.jpg" style="object-position:center 14%;">
  </div>

  <div style="position:absolute;left:56px;right:56px;top:1075px;z-index:7;">
    ${headline('Выбор тех, кто<br>ценит роскошь', 44)}
  </div>

  ${NICK}
`);

const slides = { cover, slide2, slide3, slide4 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
for (const [name, html] of Object.entries(slides)) {
  const htmlPath = path.resolve(`v5_${name}.html`);
  fs.writeFileSync(htmlPath, html);
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.resolve(`v5_${name}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
  console.log('rendered', name);
}
await browser.close();
