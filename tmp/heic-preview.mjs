import fs from "fs";
import path from "path";
import heicConvert from "heic-convert";
import sharp from "sharp";

const SRC = "C:\\Users\\Пользователь\\Desktop\\лакмода";
const OUT = "C:\\Users\\Пользователь\\Claude\\smm-system\\tmp\\heic-previews";
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter(f => f.toLowerCase().endsWith(".heic"));
console.log(`Found ${files.length} HEIC files`);

for (const f of files) {
  const inPath = path.join(SRC, f);
  const outPath = path.join(OUT, f.replace(/\.heic$/i, ".jpg"));
  try {
    const buf = fs.readFileSync(inPath);
    const jpgBuf = await heicConvert({ buffer: buf, format: "JPEG", quality: 0.85 });
    await sharp(jpgBuf).resize({ width: 720, fit: "inside" }).jpeg({ quality: 80 }).toFile(outPath);
    const size = fs.statSync(outPath).size;
    console.log(`✓ ${f} → ${path.basename(outPath)} (${(size/1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log(`✗ ${f}: ${e.message}`);
  }
}
console.log("Done");
