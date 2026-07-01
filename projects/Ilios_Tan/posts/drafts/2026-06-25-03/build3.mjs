import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const W = 1080, H = 1350;
const BG = '#3F5870'; // приглушённый синий, одинаковый на всех слайдах

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@600;700&display=swap');`;

const NICK = `
  <div style="position:absolute;right:48px;bottom:48px;z-index:12;border:2px solid #FFFFFF;padding:12px 26px;background:rgba(20,30,40,0.18);">
    <div style="font-family:'Anton',sans-serif;color:#FFFFFF;font-size:30px;letter-spacing:0.05em;">ILIOS TAN</div>
  </div>
`;

const STAR = (style) => `<img class="sticker" src="star.png" style="position:absolute;z-index:9;${style}">`;

const base = (inner) => `<!doctype html><html><head><meta charset="utf-8">
<style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;overflow:hidden;background:${BG};position:relative;}
.head{font-family:'Anton',sans-serif;color:#FFFFFF;}
.polaroid{position:absolute;background:#FAF7EF;padding:16px 16px 16px 16px;box-shadow:0 24px 50px rgba(0,0,0,0.35);z-index:4;}
.polaroid img{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(1.1) contrast(1.05) brightness(1.02);}
</style></head><body>${inner}</body></html>`;

// ---------- Slide 1: cover ----------
const cover = base(`
  ${STAR('top:-70px;right:-90px;width:300px;')}
  <div style="position:absolute;top:80px;left:56px;right:56px;z-index:7;">
    <div class="head" style="font-size:58px;line-height:1.12;">НАШИ ЧЕМПИОНКИ<br>НА ПЬЕДЕСТАЛЕ ПОЧЁТА</div>
  </div>

  <div class="polaroid" style="width:900px;height:900px;left:-80px;top:280px;transform:rotate(-1.2deg);">
    <img src="src2.jpg" style="object-position:center 26%;">
  </div>

  ${NICK}
`);

// ---------- Slide 2: src1 winner on podium ----------
const slide2 = base(`
  ${STAR('top:-70px;right:-90px;width:300px;')}

  <div class="polaroid" style="width:980px;height:980px;left:50%;top:60px;transform:translateX(-50%) rotate(-1deg);">
    <img src="src1.jpg" style="object-position:center 20%;">
  </div>

  <div style="position:absolute;left:56px;right:56px;top:1070px;z-index:7;">
    <div class="head" style="font-size:50px;line-height:1.1;text-align:center;">ПОБЕДА —<br>БЕЗУПРЕЧНЫЙ ЗАГАР</div>
  </div>

  ${NICK}
`);

// ---------- Slide 3: src2 team photo ----------
const slide3 = base(`
  ${STAR('top:-70px;right:-90px;width:300px;')}

  <div style="position:absolute;left:56px;top:70px;z-index:7;">
    <div class="head" style="font-size:56px;line-height:1.1;">САМЫЕ ЯРКИЕ<br>И РОСКОШНЫЕ</div>
  </div>

  <div class="polaroid" style="width:850px;height:850px;left:180px;top:300px;transform:rotate(1.4deg);">
    <img src="src2.jpg" style="object-position:center 30%;">
  </div>

  <div style="position:absolute;left:56px;right:56px;top:1170px;z-index:7;">
    <div class="head" style="font-size:42px;line-height:1.1;text-align:center;">КОМАНДА ЧЕМПИОНОК В PEARL</div>
  </div>

  ${NICK}
`);

// ---------- Slide 4: src3 close-up ----------
const slide4 = base(`
  ${STAR('top:-70px;right:-90px;width:300px;')}

  <div class="polaroid" style="width:1000px;height:1000px;left:50%;top:40px;transform:translateX(-50%) rotate(-1deg);">
    <img src="src3.jpg" style="object-position:center 14%;">
  </div>

  <div style="position:absolute;left:56px;right:56px;top:1070px;z-index:7;">
    <div class="head" style="font-size:50px;line-height:1.1;text-align:center;">ВЫБОР ТЕХ, КТО<br>ЦЕНИТ РОСКОШЬ</div>
  </div>

  ${NICK}
`);

const slides = { cover, slide2, slide3, slide4 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
for (const [name, html] of Object.entries(slides)) {
  const htmlPath = path.resolve(`v3_${name}.html`);
  fs.writeFileSync(htmlPath, html);
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.resolve(`v3_${name}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
  console.log('rendered', name);
}
await browser.close();
