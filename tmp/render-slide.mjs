// Render HTML to PNG using page.goto(file://) so local images/fonts resolve.
import puppeteer from "puppeteer";
import path from "node:path";

const [, , htmlPath, pngPath, w = "1080", h = "1350"] = process.argv;
if (!htmlPath || !pngPath) {
  console.error("Usage: node render-slide.mjs <input.html> <output.png> [width=1080] [height=1350]");
  process.exit(1);
}

const abs = path.resolve(htmlPath);
const url = "file:///" + abs.replace(/\\/g, "/");

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: +w, height: +h } });
await browser.close();
console.log(`✓ ${pngPath}`);
