// render-stories.js — рендерит каждый .slide из HTML-файла в отдельный PNG
// Usage: node tools/render-stories.js <input.html> <output-dir>
// Каждый слайд изолируется: остальные скрываются, body становится прозрачным,
// viewport выставляется точно под размер слайда.

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function main() {
  const [,, inputHtml, outputDir] = process.argv;
  if (!inputHtml || !outputDir) {
    console.error('Usage: node render-stories.js <input.html> <output-dir>');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const absPath = path.resolve(inputHtml);
  const fileUrl = 'file:///' + absPath.replace(/\\/g, '/');

  // Узнаём количество слайдов и их размер
  const probePage = await browser.newPage();
  await probePage.setViewport({ width: 1080, height: 1920 });
  await probePage.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  const { count, w, h } = await probePage.evaluate(() => {
    const slides = document.querySelectorAll('.slide');
    const first = slides[0];
    return {
      count: slides.length,
      w: first ? first.offsetWidth : 1080,
      h: first ? first.offsetHeight : 1920,
    };
  });
  await probePage.close();
  console.log(`Слайдов: ${count}, размер: ${w}×${h}`);

  for (let i = 0; i < count; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Скрываем всё кроме i-го слайда, убираем body padding/gap/background
    await page.evaluate((idx) => {
      document.body.style.cssText =
        'margin:0;padding:0;background:none;display:block;';
      const slides = document.querySelectorAll('.slide');
      slides.forEach((el, j) => {
        if (j !== idx) { el.style.display = 'none'; }
        else {
          el.style.margin = '0';
          el.style.position = 'static';
        }
      });
    }, i);

    const outPath = path.join(outputDir, `slide_0${i + 1}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    console.log(`Сохранён: ${outPath}`);
  }

  await browser.close();
  console.log('Готово.');
}

main().catch(e => { console.error(e); process.exit(1); });
