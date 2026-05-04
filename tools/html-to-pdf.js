// tools/html-to-pdf.js
// Конвертация HTML → PDF с сохранением дизайна (фоны, шрифты, цвета)
//
// Usage:
//   node html-to-pdf.js <input.html> [output.pdf]
//
// Решает проблемы ручной печати:
//   - Тёмные фоны не исчезают (printBackground: true)
//   - Шрифты загружаются корректно (локальные + CDN)
//   - Размеры страниц берутся из @page CSS (preferCSSPageSize)
//   - Сломанные Windows-пути к шрифтам заменяются на локальные

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Абсолютный путь к локальным шрифтам
const FONTS_DIR = path.resolve(__dirname, '../global/brand/fonts');
const BRAND_DIR = path.resolve(__dirname, '../global/brand');

// CSS для переопределения шрифтов + принудительная цветная печать + разрывы страниц
function buildFontOverrideCSS() {
  // Manrope: в слайдах прописаны Windows-пути — заменяем на локальные woff2.
  const fontMap = [
    { weight: 400, file: 'Manrope-Regular.woff2' },
    { weight: 700, file: 'Manrope-Bold.woff2' },
    { weight: 800, file: 'Manrope-ExtraBold.woff2' },
    { weight: 600, file: 'Manrope-Bold.woff2' },   // 600 → Bold fallback
    { weight: 500, file: 'Manrope-Regular.woff2' }, // 500 → Regular fallback
  ];

  const manropeFaces = fontMap
    .filter(({ file }) => fs.existsSync(path.join(FONTS_DIR, file)))
    .map(({ weight, file }) =>
      `@font-face { font-family: 'Manrope'; font-weight: ${weight}; font-style: normal; ` +
      `src: url('file://${FONTS_DIR}/${file}') format('woff2'); }`
    )
    .join('\n');

  // Nata Sans: статические инстансы woff2 (400/600/700/800).
  // Chrome не встраивает variable TTF правильно в PDF — конвертирует в Type 3
  // с неправильной интерполяцией. Статические woff2 встраиваются корректно.
  // Оригинальный @font-face (variable TTF) удаляется из CSSOM отдельным шагом.
  const nataSansWeights = [400, 600, 700, 800];
  const nataSansFaces = nataSansWeights
    .filter(w => fs.existsSync(path.join(FONTS_DIR, `NataSans-${w}.woff2`)))
    .map(w =>
      `@font-face { font-family: 'Nata Sans'; font-weight: ${w}; font-style: normal; ` +
      `src: url('file://${FONTS_DIR}/NataSans-${w}.woff2') format('woff2'); }`
    )
    .join('\n');

  // Фикс Ф/ф: Nata Sans имеет слитый стем (2 контура), который исчезает
  // на малых размерах при PDF-рендеринге. Ubuntu имеет раздельный стем (3 контура).
  // unicode-range ограничивает замену только символами Ф и ф — всё остальное
  // остаётся Nata Sans.
  const ubuntuWeights = [
    { w: 400, file: '/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf' },
    { w: 600, file: '/usr/share/fonts/truetype/ubuntu/Ubuntu-M.ttf' },
    { w: 700, file: '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf' },
    { w: 800, file: '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf' },
  ];
  const phiFix = ubuntuWeights
    .filter(({ file }) => fs.existsSync(file))
    .map(({ w, file }) =>
      `@font-face { font-family: 'Nata Sans'; font-weight: ${w}; font-style: normal; ` +
      `src: url('file://${file}') format('truetype'); ` +
      `unicode-range: U+0424, U+0444; }` // Ф, ф
    )
    .join('\n');

  return `
${manropeFaces}
${nataSansFaces}
${phiFix}

/* Принудительная цветная печать — без этого Chrome убирает фоны */
*, *::before, *::after {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}

/* ── РАЗРЫВЫ СТРАНИЦ ──────────────────────────────────────────
   Запрещаем разрыв ТОЛЬКО внутри самодостаточных карточек.
   НЕ применяем к ячейкам CSS-грида — это ломает layout.
   ──────────────────────────────────────────────────────────── */

/* Конкретные блоки — не разрезать внутри */
.shot, .hook, .music, .badge,
.stat, .caption-box, .tip,
.rubric-card, .comp-block {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Секционные контейнеры (.section, .card и т.п.) — держать целиком
   если влезают. Если секция больше страницы — Chrome всё равно разрежет,
   но мелкие секции (как «КАК СНИМАТЬ») не будут висеть хвостом. */
.section {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Строки таблицы не разрезать */
tr { break-inside: avoid; page-break-inside: avoid; }

/* Заголовки секций остаются со следующим блоком */
.stitle, .section-label, .meta-label,
h1, h2, h3, h4, h5 {
  break-after: avoid;
  page-break-after: avoid;
}

/* Сироты/вдовы */
p { orphans: 3; widows: 3; }

/* ── COMPACT PRINT ───────────────────────────────────────────
   В режиме печати колонка уже чем в браузере (~703px vs ~744px),
   это вызывает дополнительный перенос текста и страницы-хвосты.
   Уменьшаем отступы незначительно чтобы документ не разбивался
   на случайную почти пустую последнюю страницу.
   ──────────────────────────────────────────────────────────── */
.stitle { margin-top: 16px !important; margin-bottom: 8px !important; }
.shot   { padding: 10px 0 !important; }
.hook   { padding: 12px 16px !important; }
.music  { padding: 12px 16px !important; }
.music-why { margin-bottom: 8px !important; }
.badges { margin-bottom: 14px !important; }
.how-cell { padding: 10px 14px !important; }
.caption-box { padding: 12px 14px !important; }
.footer { margin-top: 20px !important; padding-top: 12px !important; }

/* ── CSS GRID → FLEX FIX ─────────────────────────────────────
   CSS Grid не поддерживает фрагментацию (page breaks) в
   Chromium при печати — ячейки рвутся в произвольных местах.
   Переключаем 2-колоночные гриды на flex-wrap, который
   корректно обрабатывает разрывы страниц.
   ──────────────────────────────────────────────────────────── */
.how-grid, .caption-grid, .stats, .composition-grid {
  display: flex !important;
  flex-wrap: wrap !important;
  overflow: visible !important;
  gap: 1px !important;
}

/* Ячейки: 50% ширины (имитируем 2 колонки).
   НЕ ставим break-inside: avoid — это выталкивает целые строки
   на следующую страницу когда места чуть не хватает. */
.how-cell, .caption-box, .stat {
  flex: 0 0 calc(50% - 1px) !important;
  box-sizing: border-box !important;
}

/* Полные строки — 100% */
.how-cell.full {
  flex: 0 0 100% !important;
}

/* table-wrap: обычный overflow fix */
.table-wrap { overflow: visible !important; }

/* ── TABLE CELL OVERFLOW FIX ─────────────────────────────────
   В print-режиме A4 колонка ФОРМАТ (~84px) уже браузерной.
   Бейджи с white-space:nowrap обрезаются overflow:hidden.
   Уменьшаем шрифт и padding бейджей — они влезают в колонку
   без overflow в соседнюю колонку.
   ──────────────────────────────────────────────────────────── */
td { overflow: visible !important; }
.fmt { font-size: 8.5px !important; padding: 2px 5px !important; letter-spacing: -0.1px !important; }
`;
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

async function htmlToPdf(htmlPath, outputPath) {
  const executablePath = findChrome();
  const browser = await puppeteer.launch({
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',  // нужно для локальных шрифтов в file://
      '--disable-web-security',           // разрешает CORS для file:// ресурсов
      '--run-all-compositor-stages-before-draw',
    ],
  });

  const page = await browser.newPage();

  // Режим печати — активирует @media print CSS
  await page.emulateMediaType('print');

  const absoluteHtmlPath = path.resolve(htmlPath);
  await page.goto(`file://${absoluteHtmlPath}`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });

  // Удаляем из CSSOM оригинальный @font-face variable TTF для Nata Sans.
  // Иначе при инжекции статических woff2 возникает конфликт двух деклараций,
  // который ломает рендер отдельных глифов (Ф/ф выглядит как О/о).
  await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
          const rule = sheet.cssRules[i];
          if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
          const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
          if (family === 'Nata Sans') sheet.deleteRule(i);
        }
      } catch (_) { /* cross-origin sheet */ }
    }
  });

  // Инжектируем Manrope (woff2, абсолютные пути) + Nata Sans статические инстансы
  await page.addStyleTag({ content: buildFontOverrideCSS() });

  // Ждём загрузки всех шрифтов
  await page.evaluate(() => document.fonts.ready);

  // Доп. пауза чтобы рендер осел (важно для сложных градиентов)
  await new Promise(r => setTimeout(r, 600));

  await page.pdf({
    path: outputPath,
    printBackground: true,     // сохраняем тёмные фоны и цвета
    preferCSSPageSize: true,   // берём размеры страниц из @page в CSS
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();

  const size = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`✓ PDF: ${outputPath} (${size} KB)`);
}

// CLI
const [, , htmlFile, pdfFile] = process.argv;

if (!htmlFile) {
  console.error('Usage: node html-to-pdf.js <input.html> [output.pdf]');
  process.exit(1);
}

const resolvedHtml = path.resolve(htmlFile);
if (!fs.existsSync(resolvedHtml)) {
  console.error(`File not found: ${resolvedHtml}`);
  process.exit(1);
}

const resolvedPdf = pdfFile
  ? path.resolve(pdfFile)
  : resolvedHtml.replace(/\.html$/i, '.pdf');

htmlToPdf(resolvedHtml, resolvedPdf).catch(err => {
  console.error('❌ PDF generation failed:', err.message);
  process.exit(1);
});
