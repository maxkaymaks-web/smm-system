const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const htmlPath = path.resolve(__dirname, 'template.html');
  const outPath  = path.resolve(__dirname, 'template.png');
  const W = 1080, H = 1080;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();
  console.log('OK:', outPath);
})().catch(e => { console.error(e); process.exit(1); });
