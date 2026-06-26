const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function renderFile(htmlPath, outputPath, width = 1080) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const abs = path.resolve(htmlPath);
  const url = 'file:///' + abs.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  const height = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: Number(width), height, deviceScaleFactor: 2 });
  await page.screenshot({ path: outputPath, fullPage: false, clip: { x: 0, y: 0, width: Number(width), height } });
  await browser.close();
  console.log(`Rendered: ${outputPath} (${width}x${height}px @2x)`);
}

const [, , htmlFile, pngFile, widthArg] = process.argv;
if (!htmlFile || !pngFile) { console.error('Usage: render-file.js <input.html> <output.png> [width=1080]'); process.exit(1); }
renderFile(htmlFile, pngFile, widthArg || 1080).catch(e => { console.error('Render failed:', e.message); process.exit(1); });
