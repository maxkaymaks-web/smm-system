import { fal } from "@fal-ai/client";
import https from "https";
import fs from "fs";
import path from "path";

fal.config({ credentials: process.env.FAL_KEY });

const prompt = `Photorealistic horizontal 16:9 editorial illustration, ultra-detailed 4K commercial photography.

A modern smart precision irrigation scene viewed from a low cinematic angle. Foreground left: macro close-up of a glossy black IoT soil moisture sensor planted in dark wet earth, glowing emerald LED indicator on top, slim antenna with subtle radiating wireless signal arcs in gold. Foreground center-right: drip irrigation tubing running horizontally along rows of young green wheat sprouts and golden ripe wheat ears, precise crystal-clear water droplets suspended mid-air falling onto the soil, refracting light. Mid-background: a sleek agricultural spray drone hovering low over the field, releasing a fine cone of water mist with thousands of tiny droplets sparkling, propellers in soft motion blur, small gold and emerald navigation lights. Faint translucent holographic data overlays floating subtly above — droplet icons, flow lines, small graphs — glowing emerald green and warm gold, semi-transparent, refined, not dominating.

Composition: all elements arranged horizontally across bottom 55% of frame. Top 45% completely empty negative space for typography — deep dark near-black background with subtle dark emerald green and midnight navy blue gradient, smooth, soft vignette.

Surface: dark glossy reflective wet ground scattered with thousands of tiny glowing particles in deep emerald green, dark teal and warm gold, forming the silhouette of world map continents stretched horizontally as pixel-like dots. Tiny water droplets and wheat grains scattered around.

Lighting: cinematic warm sidelight grazing from the right, shallow depth of field, soft creamy bokeh, water caustics and light beads on wet surfaces, refractions in droplets.

Color palette: deep emerald green, dark teal, warm gold, amber wheat, crystal blue water, midnight blue, near-black background.

Mood: premium analytical research report explaining smart precision irrigation in agriculture, sophisticated, hi-tech, corporate editorial. Hasselblad aesthetic, sharp focus on sensor and droplets, rich depth, professional commercial photography blended with subtle holographic UI. No text, no logos, no watermarks, no readable numbers.`;

console.log("[fal] generating...");
const result = await fal.run("fal-ai/nano-banana-2", {
  input: {
    prompt,
    aspect_ratio: "16:9",
    resolution: "4K",
    output_format: "jpeg",
    num_images: 1,
  },
});

const url = result.data.images[0].url;
console.log("[fal] url:", url);

const dest = path.join(process.env.HOME, "Desktop", `smart-irrigation-${Date.now()}.jpg`);
await new Promise((resolve, reject) => {
  const file = fs.createWriteStream(dest);
  https.get(url, r => { r.pipe(file); file.on("finish", () => { file.close(); resolve(); }); }).on("error", reject);
});
console.log("[saved]", dest);
