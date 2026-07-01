import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const W = 1080, H = 1350;

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap');`;

const base = (inner) => `<!doctype html><html><head><meta charset="utf-8">
<style>
${fontImport}
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Cormorant Garamond',serif;}
.frame{position:absolute;inset:28px;border:1.5px solid rgba(201,162,75,0.85);pointer-events:none;z-index:5;}
.tick{position:absolute;width:22px;height:22px;border-color:#C9A24B;z-index:6;pointer-events:none;}
.tick.tl{top:18px;left:18px;border-top:2px solid;border-left:2px solid;}
.tick.tr{top:18px;right:18px;border-top:2px solid;border-right:2px solid;}
.tick.bl{bottom:18px;left:18px;border-bottom:2px solid;border-left:2px solid;}
.tick.br{bottom:18px;right:18px;border-bottom:2px solid;border-right:2px solid;}
.wordmark{position:absolute;top:54px;right:62px;color:#C9A24B;font-size:22px;letter-spacing:0.16em;font-weight:600;z-index:6;}
.bg{position:absolute;inset:0;background-size:cover;background-position:center;}
.vignette-bottom{position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(to top, rgba(10,6,4,0.92) 0%, rgba(10,6,4,0.55) 45%, rgba(10,6,4,0) 100%);z-index:2;}
.vignette-top{position:absolute;left:0;right:0;top:0;height:22%;background:linear-gradient(to bottom, rgba(10,6,4,0.55) 0%, rgba(10,6,4,0) 100%);z-index:2;}
.cap{position:absolute;left:62px;right:62px;bottom:86px;z-index:6;}
.cap .line{width:64px;height:1.5px;background:#C9A24B;margin-bottom:18px;}
.cap h2{color:#FAF6EE;font-weight:600;font-size:46px;line-height:1.16;font-style:italic;text-shadow:0 2px 18px rgba(0,0,0,0.5);}
.cap p{color:#E7D9B8;font-size:21px;letter-spacing:0.04em;margin-top:14px;font-weight:500;}
</style></head><body>${inner}</body></html>`;

const frameDecor = `
<div class="frame"></div>
<div class="tick tl"></div><div class="tick tr"></div>
<div class="tick bl"></div><div class="tick br"></div>
<div class="wordmark">ILIOS TAN</div>
`;

// Slide 1 — cover (textured dark, team photo as desaturated texture, no flat gradient/circles)
const cover = base(`
<div class="bg" style="background-image:url('src2.jpg');filter:brightness(0.32) saturate(0.55) sepia(0.18) contrast(1.05);"></div>
<div style="position:absolute;inset:0;background:rgba(8,5,4,0.45);z-index:1;"></div>
${frameDecor}
<div style="position:absolute;left:62px;right:62px;top:46%;transform:translateY(-50%);z-index:6;">
  <div style="width:64px;height:1.5px;background:#C9A24B;margin-bottom:26px;"></div>
  <div style="color:#FAF6EE;font-style:italic;font-weight:600;font-size:64px;line-height:1.12;text-shadow:0 3px 22px rgba(0,0,0,0.6);">Наши спортсменки<br>на пьедестале</div>
  <div style="color:#E7D9B8;font-size:23px;letter-spacing:0.05em;margin-top:22px;font-weight:500;">кто выбирает ILIOS TAN</div>
</div>
<div style="position:absolute;left:62px;right:62px;bottom:70px;z-index:6;color:#C9A24B;font-size:18px;letter-spacing:0.18em;font-weight:600;">ВЫБОР&nbsp;&nbsp;·&nbsp;&nbsp;ЧЕМПИОНОВ&nbsp;&nbsp;·&nbsp;&nbsp;PEARL</div>
`);

// Slide 2 — src1 (winner on podium, peonies) full bleed
const slide2 = base(`
<div class="bg" style="background-image:url('src1.jpg');background-position:center 25%;filter:saturate(1.12) contrast(1.06) brightness(1.03) sepia(0.05);"></div>
<div class="vignette-top"></div>
<div class="vignette-bottom"></div>
${frameDecor}
<div class="cap">
  <div class="line"></div>
  <h2>Первое место —<br>и безупречный загар</h2>
  <p>ровно держится с разминки до пьедестала</p>
</div>
`);

// Slide 3 — src2 (team photo with medals) full bleed
const slide3 = base(`
<div class="bg" style="background-image:url('src2.jpg');background-position:center 30%;filter:saturate(1.1) contrast(1.05) brightness(1.02) sepia(0.04);"></div>
<div class="vignette-top"></div>
<div class="vignette-bottom"></div>
${frameDecor}
<div class="cap">
  <div class="line"></div>
  <h2>ILIOS GIRLS —<br>самые яркие и роскошные</h2>
  <p>команда чемпионок в Pearl</p>
</div>
`);

// Slide 4 — src3 (close-up with cup/medal) full bleed
const slide4 = base(`
<div class="bg" style="background-image:url('src3.jpg');background-position:center 18%;filter:saturate(1.08) contrast(1.07) brightness(1.05) sepia(0.05);"></div>
<div class="vignette-top"></div>
<div class="vignette-bottom"></div>
${frameDecor}
<div class="cap">
  <div class="line"></div>
  <h2>ILIOS TAN —<br>выбор тех, кто ценит роскошь</h2>
  <p>выбор чемпионов</p>
</div>
`);

const slides = { cover, slide2, slide3, slide4 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
for (const [name, html] of Object.entries(slides)) {
  const htmlPath = path.resolve(`${name}.html`);
  fs.writeFileSync(htmlPath, html);
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.resolve(`${name}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
  console.log('rendered', name);
}
await browser.close();
