// tools/render-html.js
// Usage: node render-html.js <input.html> <output.png> [width]
// Default width: 1080px (VK post standard)

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Try to find Chrome executable — skip snap chromium (sandboxed, can't read host filesystem)
function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null; // let puppeteer use its own bundled chrome
}

async function renderHtml(htmlPath, outputPath, width = 1080) {
  // Use puppeteer's bundled Chrome (skip snap chromium — sandboxed, can't access host filesystem).
  const systemChrome = findChrome();
  const browser = await puppeteer.launch({
    executablePath: systemChrome || puppeteer.executablePath(),
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--single-process',
    ],
  });

  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(htmlPath).replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  // Allow web fonts (Google Fonts etc.) to load
  await new Promise((r) => setTimeout(r, 2000));

  const height = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: Number(width), height, deviceScaleFactor: 2 });

  await page.screenshot({
    path: outputPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: Number(width), height },
  });

  await browser.close();
  console.log(`Rendered: ${outputPath} (${width}x${height}px @2x)`);
}

const [, , htmlFile, pngFile, widthArg] = process.argv;

if (!htmlFile || !pngFile) {
  console.error('Usage: node render-html.js <input.html> <output.png> [width=1080]');
  process.exit(1);
}

renderHtml(htmlFile, pngFile, widthArg || 1080).catch((err) => {
  console.error('Render failed:', err.message);
  process.exit(1);
});
