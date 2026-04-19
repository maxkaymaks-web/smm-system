#!/usr/bin/env node
/**
 * generate-image.mjs — fal.ai image generation CLI
 * Usage: node tools/generate-image.mjs <prompt> <output.jpg> [aspect_ratio] [resolution]
 *
 * aspect_ratio: 1:1 | 16:9 | 9:16 | 4:3 | 3:4 (default: 3:4 for portrait posts)
 * resolution:   0.5K | 1K | 2K | 4K (default: 1K)
 *
 * Requires: npm install @fal-ai/client
 * API key: ~/.claude/.env.fal → FAL_KEY=...
 */

import { fal } from "@fal-ai/client";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

// Load FAL_KEY from ~/.claude/.env.fal
const envPath = path.join(process.env.HOME, ".claude/.env.fal");
let FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  FAL_KEY = envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim();
}
if (!FAL_KEY) {
  console.error("FAL_KEY not found. Set in ~/.claude/.env.fal or env.");
  process.exit(1);
}

fal.config({ credentials: FAL_KEY });

async function downloadFile(url, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (r) => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(outputPath); });
    }).on("error", reject);
  });
}

const [,, prompt, outputPath, aspectRatio = "3:4", resolution = "1K"] = process.argv;

if (!prompt || !outputPath) {
  console.error("Usage: node tools/generate-image.mjs <prompt> <output.jpg> [aspect_ratio] [resolution]");
  console.error("Example: node tools/generate-image.mjs \"elegant beauty studio interior\" assets/bg.jpg 3:4 1K");
  process.exit(1);
}

console.log(`Generating: "${prompt}"`);
console.log(`Output: ${outputPath} | ${aspectRatio} | ${resolution}`);

const result = await fal.run("fal-ai/nano-banana-2", {
  input: {
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    output_format: "jpeg",
    num_images: 1,
  },
});

const imageUrl = result.data.images[0].url;
await downloadFile(imageUrl, outputPath);

console.log("✓ Saved:", outputPath);
console.log("  Description:", result.data.description);
