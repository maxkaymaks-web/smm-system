import fs from "fs";
import path from "path";
import heicConvert from "heic-convert";
import sharp from "sharp";

const SRC = "C:\\Users\\Пользователь\\Desktop\\лакмода";
const OUT = "C:\\Users\\Пользователь\\Claude\\smm-system\\projects\\Lakmoda\\posts\\drafts\\05_05_2026-1\\v3";
fs.mkdirSync(OUT, { recursive: true });

const picks = [
  { src: "IMG_9941.HEIC", dst: "photo_v3_1.jpg" },
  { src: "IMG_9784.HEIC", dst: "photo_v3_2.jpg" },
  { src: "IMG_9786.HEIC", dst: "photo_v3_3.jpg" },
  { src: "IMG_9952.HEIC", dst: "photo_v3_4.jpg" },
];

for (const { src, dst } of picks) {
  const buf = fs.readFileSync(path.join(SRC, src));
  const jpgBuf = await heicConvert({ buffer: buf, format: "JPEG", quality: 0.92 });
  // center-crop to square at native resolution, then resize to 1440x1440 (2x of 720 disc)
  const meta = await sharp(jpgBuf).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.floor((meta.width - side) / 2);
  const top = Math.floor((meta.height - side) / 2);
  await sharp(jpgBuf)
    .extract({ left, top, width: side, height: side })
    .resize(1440, 1440, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, dst));
  const size = fs.statSync(path.join(OUT, dst)).size;
  console.log(`✓ ${src} → ${dst} (${(size / 1024).toFixed(0)} KB, 1440×1440)`);
}
console.log("Done");
