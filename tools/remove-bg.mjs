#!/usr/bin/env node
/**
 * remove-bg.mjs — remove background via fal-ai/bria/background/remove
 * Usage: node tools/remove-bg.mjs <input.jpg> <output.png>
 *
 * Output is PNG with transparent background.
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
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const file = fs.createWriteStream(outputPath);
    lib.get(url, (r) => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node tools/remove-bg.mjs <input.jpg> <output.png>");
  process.exit(1);
}

console.log(`Uploading ${inputPath}...`);
const fileBuffer = fs.readFileSync(inputPath);
const mimeType = inputPath.endsWith(".png") ? "image/png" : "image/jpeg";
const blob = new Blob([fileBuffer], { type: mimeType });
const imageUrl = await fal.storage.upload(blob, { contentType: mimeType });
console.log("Uploaded:", imageUrl);

console.log("Removing background (BRIA RMBG 2.0)...");
const result = await fal.subscribe("fal-ai/bria/background/remove", {
  input: { image_url: imageUrl },
  logs: true,
  onQueueUpdate: (u) => {
    if (u.status === "IN_PROGRESS") u.logs?.forEach(l => console.log("[fal]", l.message));
  },
});

const resultUrl = result.data.image.url;
console.log("Downloading result...");
await downloadFile(resultUrl, outputPath);
console.log("✓ Saved:", outputPath);
console.log(`  ${result.data.image.width}x${result.data.image.height}px | PNG with transparent bg`);
