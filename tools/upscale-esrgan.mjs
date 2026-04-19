#!/usr/bin/env node
/**
 * upscale-esrgan.mjs — upscale image via fal.ai Real-ESRGAN
 * Usage: node tools/upscale-esrgan.mjs <input.jpg> <output.jpg>
 * Requires: npm install @fal-ai/client
 */

import { fal } from "@fal-ai/client";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";

// Load FAL_KEY
const envPath = path.join(process.env.HOME, ".claude/.env.fal");
let FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY && fs.existsSync(envPath)) {
  FAL_KEY = fs.readFileSync(envPath, "utf-8").match(/FAL_KEY=(.+)/)?.[1]?.trim();
}
if (!FAL_KEY) { console.error("FAL_KEY not found"); process.exit(1); }

fal.config({ credentials: FAL_KEY });

async function downloadFile(url, outputPath) {
  const lib = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    lib.get(url, (r) => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node tools/upscale-esrgan.mjs <input.jpg> <output.jpg>");
  process.exit(1);
}

console.log(`Uploading ${inputPath}...`);
const fileBuffer = fs.readFileSync(inputPath);
const blob = new Blob([fileBuffer], { type: "image/jpeg" });
const uploadedUrl = await fal.storage.upload(blob, { contentType: "image/jpeg" });
console.log("Uploaded:", uploadedUrl);

console.log("Running ESRGAN upscale...");
const result = await fal.run("fal-ai/esrgan", {
  input: {
    image_url: uploadedUrl,
    model: "RealESRGAN_x4plus",
    scale: 2,
    face_enhance: false,
    tile: 0,
  },
});

const imageUrl = result.data.image.url;
console.log("Downloading result...");
await downloadFile(imageUrl, outputPath);
console.log("✓ Saved:", outputPath);
