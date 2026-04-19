// tools/render-html.js
// Usage: node render-html.js <input.html> <output.png> [width]
// Default width: 1080px (VK post standard)

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Try to find Chrome executable
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
  return null; // let puppeteer find its own
}

async function renderHtml(htmlPath, outputPath, width = 1080) {
  const executablePath = findChrome();
  const launchOptions = {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  const absoluteHtmlPath = path.resolve(htmlPath);
  await page.goto(`file://${absoluteHtmlPath}`, { waitUntil: 'networkidle0' });

  // Get actual content height
  const height = await page.evaluate(() => document.body.scrollHeight);

  await page.setViewport({
    width: Number(width),
    height: height,
    deviceScaleFactor: 2, // 2x resolution — crisp on retina
  });

  await page.screenshot({
    path: outputPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: Number(width), height: height },
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
