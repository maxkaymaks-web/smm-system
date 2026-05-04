// tools/slides-to-pdf.js
// Конвертация папки со слайдами → один PDF
//
// Usage:
//   node slides-to-pdf.js <папка> [output.pdf] [--quality 90] [--scale 2]
//
// Флаги:
//   --quality [1-100]  JPEG-качество (по умолчанию: 90)
//   --scale [1|2]      Плотность пикселей, 2 = retina/2x (по умолчанию: 2)
//
// Примеры:
//   node slides-to-pdf.js posts/drafts/29_04_2026-1/
//   node slides-to-pdf.js posts/drafts/22_04_2026-1/ carousel.pdf
//   node slides-to-pdf.js posts/drafts/22_04_2026-1/ --quality 85 --scale 1

const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

const FONTS_DIR = path.resolve(__dirname, '../global/brand/fonts');

function buildFontOverrideCSS() {
  const manropeMap = [
    { weight: 400, file: 'Manrope-Regular.woff2' },
    { weight: 500, file: 'Manrope-Regular.woff2' },
    { weight: 600, file: 'Manrope-Bold.woff2' },
    { weight: 700, file: 'Manrope-Bold.woff2' },
    { weight: 800, file: 'Manrope-ExtraBold.woff2' },
  ];

  // Слайды используют Manrope (сломанные Windows-пути) и CDN-шрифты.
  // Nata Sans в слайдах не используется — не инжектируем.
  return manropeMap
    .filter(({ file }) => fs.existsSync(path.join(FONTS_DIR, file)))
    .map(
      ({ weight, file }) =>
        `@font-face { font-family: 'Manrope'; font-weight: ${weight}; font-style: normal; ` +
        `src: url('file://${FONTS_DIR}/${file}') format('woff2'); }`
    )
    .join('\n');
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** Рендерит один HTML как JPEG-скриншот, возвращает { buffer, width, height } */
async function renderSlideAsJpeg(browser, htmlPath, quality, scale) {
  const page = await browser.newPage();
  const absolutePath = path.resolve(htmlPath);

  await page.goto(`file://${absolutePath}`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });

  // Определяем реальные размеры слайда
  const dims = await page.evaluate(() => {
    const el =
      document.querySelector('.slide') ||
      document.querySelector('[class*="slide"]') ||
      document.body;
    return {
      width: el.offsetWidth || document.body.scrollWidth,
      height: el.offsetHeight || document.body.scrollHeight,
    };
  });

  // Инжектируем локальные Manrope woff2 (заменяем сломанные Windows-пути)
  await page.addStyleTag({ content: buildFontOverrideCSS() });

  // Устанавливаем viewport точно под слайд (scale для retina)
  await page.setViewport({
    width: dims.width,
    height: dims.height,
    deviceScaleFactor: scale,
  });

  // Ждём шрифты
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));

  const buffer = await page.screenshot({
    type: 'jpeg',
    quality,
    fullPage: false,
    clip: { x: 0, y: 0, width: dims.width, height: dims.height },
  });

  await page.close();
  return { buffer, width: dims.width, height: dims.height };
}

async function slidesToPdf(folderPath, outputPath, { quality = 90, scale = 2 } = {}) {
  const files = fs.readdirSync(folderPath)
    .filter(f => f.toLowerCase().endsWith('.html'))
    .sort()
    .map(f => path.join(folderPath, f));

  if (files.length === 0) {
    console.error(`❌ HTML-файлы не найдены в: ${folderPath}`);
    process.exit(1);
  }

  console.log(`Найдено слайдов: ${files.length} | quality: ${quality}% | scale: ${scale}x`);
  files.forEach((f, i) => console.log(`  ${i + 1}. ${path.basename(f)}`));
  console.log('');

  const executablePath = findChrome();
  const browser = await puppeteer.launch({
    executablePath: executablePath || undefined,
    protocolTimeout: 60000,  // скриншоты сложных слайдов могут занять >30s
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',
      '--disable-web-security',
      '--run-all-compositor-stages-before-draw',
    ],
  });

  const slides = [];
  for (let i = 0; i < files.length; i++) {
    process.stdout.write(`  Рендеринг ${i + 1}/${files.length}: ${path.basename(files[i])}... `);
    const slide = await renderSlideAsJpeg(browser, files[i], quality, scale);
    slides.push(slide);
    const kb = Math.round(slide.buffer.byteLength / 1024);
    console.log(`${kb} KB`);
  }

  await browser.close();

  // Создаём PDF с JPEG-страницами
  console.log('\nСобираю PDF...');
  const pdfDoc = await PDFDocument.create();

  for (const { buffer, width, height } of slides) {
    const img = await pdfDoc.embedJpg(buffer);

    // CSS px → PDF points: 1px = 72/96 pt = 0.75 pt
    const wPts = width * 0.75;
    const hPts = height * 0.75;

    const page = pdfDoc.addPage([wPts, hPts]);
    page.drawImage(img, { x: 0, y: 0, width: wPts, height: hPts });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  console.log(`✓ PDF: ${outputPath} (${sizeMB} MB, ${slides.length} страниц)`);
}

// ── CLI parsing ──
const args = process.argv.slice(2);
let folderArg, pdfArg;
let quality = 90;
let scale = 2;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--quality' && args[i + 1]) {
    quality = Number(args[++i]);
  } else if (args[i] === '--scale' && args[i + 1]) {
    scale = Number(args[++i]);
  } else if (!folderArg) {
    folderArg = args[i];
  } else if (!pdfArg && !args[i].startsWith('--')) {
    pdfArg = args[i];
  }
}

if (!folderArg) {
  console.error('Usage: node slides-to-pdf.js <folder> [output.pdf] [--quality 90] [--scale 2]');
  process.exit(1);
}

const resolvedFolder = path.resolve(folderArg);
if (!fs.existsSync(resolvedFolder)) {
  console.error(`Папка не найдена: ${resolvedFolder}`);
  process.exit(1);
}

const resolvedPdf = pdfArg
  ? path.resolve(pdfArg)
  : path.join(resolvedFolder, 'slides.pdf');

slidesToPdf(resolvedFolder, resolvedPdf, { quality, scale }).catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
