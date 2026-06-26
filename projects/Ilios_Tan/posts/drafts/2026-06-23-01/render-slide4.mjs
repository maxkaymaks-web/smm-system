import puppeteer from 'puppeteer';
import path from 'path';
import { pathToFileURL } from 'url';

const htmlPath = path.resolve('slide4_v1.html');
const outPath = path.resolve('slide4_v1.png');

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 60000 });
await new Promise((r) => setTimeout(r, 1200));
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
await browser.close();
console.log('Rendered', outPath);
