#!/usr/bin/env node
/**
 * upscale.mjs — upscale image via fal-ai/seedvr/upscale/image (SeedVR2)
 * Usage: node tools/upscale.mjs <input.jpg> <output.jpg> [factor] [format]
 *
 * factor:  upscale multiplier (default: 2)
 * format:  jpg | png | webp (default: jpg)
 *
 * Альтернатива: upscale_mode=target, task resolution
 *   node tools/upscale.mjs input.jpg output.jpg target 2160p
 *
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

const [,, inputPath, outputPath, factorOrMode = "2", targetRes = "1080p"] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node tools/upscale.mjs <input.jpg> <output.jpg> [factor] [format]");
  console.error("  Factor mode:  node tools/upscale.mjs in.jpg out.jpg 2");
  console.error("  Target mode:  node tools/upscale.mjs in.jpg out.jpg target 2160p");
  process.exit(1);
}

const isTargetMode = factorOrMode === "target";
const upscaleInput = isTargetMode
  ? { upscale_mode: "target", target_resolution: targetRes }
  : { upscale_mode: "factor", upscale_factor: parseFloat(factorOrMode) };

const outputFormat = outputPath.endsWith(".png") ? "png" : outputPath.endsWith(".webp") ? "webp" : "jpg";

console.log(`Uploading ${inputPath}...`);
const fileBuffer = fs.readFileSync(inputPath);
const mimeType = inputPath.endsWith(".png") ? "image/png" : "image/jpeg";
const blob = new Blob([fileBuffer], { type: mimeType });
const imageUrl = await fal.storage.upload(blob, { contentType: mimeType });
console.log("Uploaded:", imageUrl);

console.log(`Upscaling via SeedVR2 (${isTargetMode ? `target: ${targetRes}` : `×${factorOrMode}`})...`);
const result = await fal.subscribe("fal-ai/seedvr/upscale/image", {
  input: {
    image_url: imageUrl,
    ...upscaleInput,
    output_format: outputFormat,
    noise_scale: 0.1,
  },
  logs: true,
  onQueueUpdate: (u) => {
    if (u.status === "IN_PROGRESS") u.logs?.forEach(l => console.log("[fal]", l.message));
  },
});

const resultUrl = result.data.image.url;
console.log("Downloading result...");
await downloadFile(resultUrl, outputPath);
console.log("✓ Saved:", outputPath);
console.log(`  ${result.data.image.width}x${result.data.image.height}px`);
