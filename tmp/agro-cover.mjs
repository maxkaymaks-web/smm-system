import { fal } from "@fal-ai/client";
import https from "https";
import fs from "fs";
import path from "path";

fal.config({ credentials: process.env.FAL_KEY });

const prompt = `Photorealistic vertical 9:16 magazine cover, ultra-detailed 4K editorial photography.
Bottom half: golden ripe wheat ears in sharp macro focus lying diagonally across a dark glossy reflective surface, scattered with thousands of tiny glowing particles in deep emerald green, dark teal and warm gold, forming the silhouette of world map continents made of pixel-like dots and microscopic seeds. Loose wheat grains and tiny droplets scattered around. Cinematic warm sidelight grazing the wheat from the right, shallow depth of field, soft creamy bokeh, beads of light.
Top half: deep dark almost black background with subtle dark emerald green and midnight navy blue gradient, completely empty negative space, smooth, no objects, soft vignette, premium clean area for typography.
Mood: premium analytical financial agricultural report cover, sophisticated, modern, corporate editorial.
Color palette: deep emerald green, dark teal, warm gold, amber wheat, midnight blue, near-black background.
Sharp focus on wheat ears, rich depth, professional commercial photography, Hasselblad aesthetic, high-end report cover, no text, no logo, no watermark.`;

console.log("[fal] generating...");
const result = await fal.run("fal-ai/nano-banana-2", {
  input: {
    prompt,
    aspect_ratio: "9:16",
    resolution: "4K",
    output_format: "jpeg",
    num_images: 1,
  },
});

const url = result.data.images[0].url;
console.log("[fal] url:", url);

const dest = path.join(process.env.HOME, "Desktop", `agro-marketing-cover-${Date.now()}.jpg`);
await new Promise((resolve, reject) => {
  const file = fs.createWriteStream(dest);
  https.get(url, r => { r.pipe(file); file.on("finish", () => { file.close(); resolve(); }); }).on("error", reject);
});
console.log("[saved]", dest);
