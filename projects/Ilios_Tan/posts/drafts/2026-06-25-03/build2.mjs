import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const W = 1080, H = 1350;

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@600;700&family=Playfair+Display:ital,wght@1,700&family=Inter:wght@600;700&display=swap');`;

const base = (bg, inner) => `<!doctype html><html><head><meta charset="utf-8">
<style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;overflow:hidden;background:${bg};position:relative;}
.anton{font-family:'Anton',sans-serif;}
.caveat{font-family:'Caveat',cursive;}
.playfair{font-family:'Playfair Display',serif;}
.inter{font-family:'Inter',sans-serif;}
.sticker{position:absolute;z-index:8;}
.polaroid{position:absolute;background:#FAF7EF;padding:18px 18px 64px 18px;box-shadow:0 24px 50px rgba(0,0,0,0.35);z-index:4;}
.polaroid img{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(1.1) contrast(1.05) brightness(1.02);}
.polaroid .pcap{position:absolute;left:18px;right:18px;bottom:14px;font-family:'Caveat',cursive;font-size:26px;color:#3a2a1a;text-align:center;}
.label{position:absolute;z-index:9;}
.taped{position:absolute;width:170px;height:60px;z-index:10;opacity:0.95;}
</style></head><body>${bg ? '' : ''}${inner}</body></html>`;

// ---------- Slide 1: COVER — type collage, no photo darkening (no main photo at all, polaroid corner only) ----------
const cover = base('#1C2E22', `
  <img class="sticker" src="star.png" style="top:-90px;left:-110px;width:300px;opacity:0.95;transform:rotate(-12deg);z-index:1;">
  <img class="sticker" src="laurel.png" style="top:380px;left:-90px;width:420px;opacity:0.9;">

  <div style="position:absolute;top:150px;left:64px;right:64px;z-index:7;">
    <div class="caveat" style="font-size:54px;color:#E7C26B;transform:rotate(-4deg);margin-bottom:-6px;">Наши</div>
    <div class="anton" style="font-size:108px;line-height:0.96;color:#FAF6EC;letter-spacing:0.01em;">ЧЕМПИОНКИ</div>
    <div class="playfair" style="font-style:italic;font-size:36px;color:#E7C26B;margin-top:6px;">на пьедестале почёта</div>
  </div>

  <img class="sticker" src="seal.png" style="top:430px;right:54px;width:150px;transform:rotate(8deg);">

  <div class="polaroid" style="width:430px;height:430px;right:60px;bottom:130px;transform:rotate(4deg);">
    <img src="src2.jpg" style="object-position:center 25%;">
    <div class="pcap">наша команда ILIOS</div>
  </div>
  <img class="taped" src="tape.png" style="right:255px;bottom:530px;transform:rotate(-38deg);width:150px;">

  <div class="label inter" style="left:64px;bottom:70px;color:#E7C26B;font-size:18px;letter-spacing:0.22em;font-weight:700;">ILIOS TAN&nbsp;&nbsp;·&nbsp;&nbsp;PEARL&nbsp;&nbsp;·&nbsp;&nbsp;ВЫБОР ЧЕМПИОНОВ</div>
`);

// ---------- Slide 2: src1 winner on podium, cream bg, full visible photo ----------
const slide2 = base('#F3ECDC', `
  <img class="sticker" src="star.png" style="top:40px;right:-60px;width:260px;transform:rotate(10deg);">
  <img class="sticker" src="laurel.png" style="bottom:-70px;left:-90px;width:380px;opacity:0.85;">

  <div class="polaroid" style="width:660px;height:870px;left:50%;top:150px;transform:translateX(-50%) rotate(-2.5deg);">
    <img src="src1.jpg" style="object-position:center 22%;">
    <div class="pcap">первое место · ILIOS TAN</div>
  </div>
  <img class="taped" src="tape.png" style="left:50%;top:108px;transform:translateX(-50%) rotate(-3deg);width:190px;">
  <img class="sticker" src="seal.png" style="left:108px;top:430px;width:170px;transform:rotate(-10deg);">

  <div style="position:absolute;top:60px;left:60px;z-index:7;">
    <div class="anton" style="font-size:54px;color:#1C2E22;line-height:1;">ПОБЕДА</div>
  </div>

  <div style="position:absolute;bottom:64px;left:60px;right:60px;z-index:7;">
    <div class="caveat" style="font-size:42px;color:#7a3b14;transform:rotate(-2deg);">ровно держится с разминки до пьедестала</div>
    <div class="inter" style="font-size:16px;letter-spacing:0.18em;color:#1C2E22;font-weight:700;margin-top:10px;">БЕЗУПРЕЧНЫЙ ЗАГАР ILIOS TAN</div>
  </div>
`);

// ---------- Slide 3: src2 team photo, deep burgundy bg ----------
const slide3 = base('#3B1018', `
  <img class="sticker" src="star.png" style="top:-100px;right:-120px;width:280px;opacity:0.95;z-index:1;">
  <img class="sticker" src="laurel.png" style="bottom:60px;right:-80px;width:300px;opacity:0.9;transform:scaleX(-1);">

  <div class="polaroid" style="width:640px;height:830px;left:60px;top:200px;transform:rotate(3deg);">
    <img src="src2.jpg" style="object-position:center 28%;">
    <div class="pcap">ILIOS GIRLS</div>
  </div>
  <img class="taped" src="tape.png" style="left:120px;top:158px;transform:rotate(4deg);width:190px;">

  <div style="position:absolute;top:90px;right:56px;text-align:right;z-index:7;">
    <div class="playfair" style="font-style:italic;font-size:40px;color:#E7C26B;">самые яркие</div>
    <div class="anton" style="font-size:64px;color:#FAF6EC;line-height:1;margin-top:2px;">И РОСКОШНЫЕ</div>
  </div>

  <img class="sticker" src="seal.png" style="right:70px;bottom:300px;width:160px;transform:rotate(14deg);">
  <div class="inter" style="position:absolute;bottom:64px;right:56px;color:#E7C26B;font-size:17px;letter-spacing:0.16em;font-weight:700;z-index:7;text-align:right;">КОМАНДА ЧЕМПИОНОК В PEARL</div>
`);

// ---------- Slide 4: src3 close-up, navy bg ----------
const slide4 = base('#13203A', `
  <img class="sticker" src="laurel.png" style="top:-90px;left:-100px;width:440px;opacity:0.85;">
  <img class="sticker" src="star.png" style="bottom:-60px;right:-60px;width:300px;opacity:0.95;">

  <div class="polaroid" style="width:560px;height:740px;left:50%;top:190px;transform:translateX(-50%) rotate(-3deg);">
    <img src="src3.jpg" style="object-position:center 16%;">
    <div class="pcap">кубок и медаль ILIOS</div>
  </div>
  <img class="taped" src="tape.png" style="left:50%;top:150px;transform:translateX(-50%) rotate(2deg);width:190px;">
  <img class="sticker" src="seal.png" style="left:74px;top:560px;width:160px;transform:rotate(-12deg);">

  <div style="position:absolute;top:74px;left:64px;right:64px;z-index:7;">
    <div class="anton" style="font-size:50px;color:#FAF6EC;letter-spacing:0.01em;">ILIOS TAN</div>
  </div>

  <div style="position:absolute;bottom:70px;left:64px;right:64px;z-index:7;">
    <div class="caveat" style="font-size:46px;color:#E7C26B;transform:rotate(-1.5deg);">выбор тех, кто ценит роскошь</div>
    <div class="inter" style="font-size:16px;letter-spacing:0.18em;color:#FAF6EC;font-weight:700;margin-top:10px;">ВЫБОР ЧЕМПИОНОВ</div>
  </div>
`);

const slides = { cover, slide2, slide3, slide4 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
for (const [name, html] of Object.entries(slides)) {
  const htmlPath = path.resolve(`v2_${name}.html`);
  fs.writeFileSync(htmlPath, html);
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.resolve(`v2_${name}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  await page.close();
  console.log('rendered', name);
}
await browser.close();
