const sharp = require("sharp");
const fs = require("fs");

const SRC = "/Users/maxkaymaks/Desktop/карта-v3-1777984220267.png";
const OUT = `/Users/maxkaymaks/Desktop/карта-final-${Date.now()}.png`;

const W = 1920, H = 1072;
const FILL = "#E8E8E8";
const STROKE = "#909090";
const SW = 1.2;

// Crimea polygon coordinates (in 1920x1072 space)
// Mainland SW landmass: extends south to ~(485, 725). Empty space = Black Sea.
// Place Crimea west/south of mainland tip, connected by thin isthmus to Kherson area.

// Crimea — diamond peninsula, top edge overlaps southern coast of mainland
// Mainland southern coast in this x-range is around y=580-600. Top of Crimea at y=575 (overlaps).
const crimea = `M 320,575
                L 415,575
                L 445,600
                L 460,630
                L 445,660
                L 410,675
                L 365,680
                L 320,672
                L 285,655
                L 270,635
                L 285,605
                Z`;

const sevastopol = `M 275,640
                    L 263,648
                    L 263,660
                    L 280,663
                    L 290,653
                    Z`;

const isthmus = ``;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <path d="${crimea}" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="${sevastopol}" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
  <path d="${isthmus}" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>
</svg>`;

fs.writeFileSync("/tmp/crimea-overlay.svg", svg);

sharp(SRC)
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .toFile(OUT)
  .then(() => console.log(`SAVED: ${OUT}`))
  .catch(e => { console.error(e); process.exit(1); });
