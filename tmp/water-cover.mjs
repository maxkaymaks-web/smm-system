import { fal } from "@fal-ai/client";
import https from "https";
import fs from "fs";
import path from "path";

fal.config({ credentials: process.env.FAL_KEY });

const prompt = `Photorealistic vertical 9:16 magazine cover, ultra-detailed 4K editorial photography.
Bottom half composition: a large crystal-clear water droplet shaped like a globe in macro focus, refracting and showing continents of the world map inside it, suspended above a dark glossy reflective surface. Below the droplet — fine mist and thin streams of water falling from above as precision irrigation, frozen mid-air, splashing onto golden ripe wheat ears and young green sprouts. In the deep background, slightly out of focus, a sleek modern agricultural drone hovering, releasing a fine spray of water mist over the field, soft motion blur on the propellers, small navigation lights glowing. Scattered on the dark wet surface — thousands of tiny glowing particles in deep emerald green, dark teal and warm gold forming the silhouette of world map continents made of pixel-like dots. Tiny water droplets and wheat grains scattered around. Cinematic warm sidelight grazing from the right, shallow depth of field, soft creamy bokeh, refractions and caustics in the water.
Top half: deep dark almost black background with subtle dark emerald green and midnight navy blue gradient, completely empty negative space, smooth, no objects, soft vignette, premium clean area for typography.
Mood: premium analytical research report cover about water and precision agriculture, sophisticated, modern, hi-tech, corporate editorial.
Color palette: deep emerald green, dark teal, warm gold, amber, crystal blue water highlights, midnight blue, near-black background.
Sharp focus on droplet and wheat, rich depth, professional commercial photography, Hasselblad aesthetic, hi-tech agriculture, no text, no logo, no watermark.`;

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

const dest = path.join(process.env.HOME, "Desktop", `agro-water-drone-cover-${Date.now()}.jpg`);
await new Promise((resolve, reject) => {
  const file = fs.createWriteStream(dest);
  https.get(url, r => { r.pipe(file); file.on("finish", () => { file.close(); resolve(); }); }).on("error", reject);
});
console.log("[saved]", dest);
