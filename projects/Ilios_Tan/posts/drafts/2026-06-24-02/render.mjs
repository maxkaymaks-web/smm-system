import puppeteer from 'puppeteer';
import path from 'path';
import { pathToFileURL } from 'url';

const slides = ['slide2', 'slide3'];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const name of slides) {
  const htmlPath = path.resolve(`${name}.html`);
  const outPath = path.resolve(`${name}.png`);
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
  await page.close();
  console.log('Rendered', outPath);
}

await browser.close();
