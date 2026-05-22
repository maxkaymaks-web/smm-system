import { fal } from "@fal-ai/client";
import https from "https";
import fs from "fs";
import path from "path";

fal.config({ credentials: process.env.FAL_KEY });

const prompt = `Hyper-realistic 3D product render, ultra-detailed 4K studio photography, on a pure pristine white seamless background (#FFFFFF), with soft realistic contact shadow directly under the object only — easy to cut out and place on any background.

SUBJECT: a single conceptual hero object — a realistic water droplet transforming / morphing into a circular coin. The object is one continuous sculpture in two phases.

LEFT HALF: a large perfectly formed realistic water droplet, classic rounded teardrop shape with pointed top, slightly squashed by gravity at the base, rendered in fully REALISTIC photographic water — transparent crystal-clear with cool light cyan-blue tint, true glass-like refraction showing distorted background through it, sharp specular highlights, soft inner caustics. Surface tension visible at the edges.

TRANSITION ZONE (center): the water droplet smoothly morphs into solid material — the bottom-right side of the droplet visibly hardens and transitions seamlessly into the coin. A soft fluid blend zone where you can see liquid still rippling but solidifying, a few tiny water droplets and splashes detaching from the transition point, frozen mid-air, catching light.

RIGHT HALF: a perfectly circular thick coin shown at a slight three-quarter angle so its disc face and edge thickness are both visible. The coin has a subtle bas-relief water droplet symbol embossed on its face — minimalist, no text, no numbers, no country markings. Thick clean rim with a subtle milled edge texture.

COIN AND SOLID PART MATERIAL: rich deep emerald green satin-matte metallic finish — soft satin sheen, low-key polish, NOT mirror chrome and NOT fully matte. Brushed anodized green metal or pearl-coated ceramic feel, clearly metallic with diffused muted reflections, soft tonal gradients from deep dark forest-green shadows to bright neon emerald highlights along the curves and rim. Subtle slight green chrome only on the very rim of the coin. Surface perfectly smooth, premium. Faint internal neon emerald glow on the embossed droplet symbol.

EXTRA WATER DETAILS: 3-4 tiny realistic water droplets sit on the surface of the coin near the transition zone, as if water is still settling, each casting a tiny soft shadow. 2-3 micro droplets float suspended in mid-air around the morph point, frozen in motion.

PROPORTIONS: object stretched horizontally — full droplet→coin sculpture occupies roughly 75-80% of frame width and about 55-60% of frame height, centered. Generous white negative space all around.

LIGHTING: clean three-point studio softbox lighting, soft white from upper left, gentle fill from right, subtle rim light from behind making the coin edge glow neon emerald and making the water sparkle with crisp specular highlights. Soft realistic ambient occlusion shadow under the object on the white floor.

COMPOSITION: single hero sculpture centered in frame, isolated, no other elements, no surface texture on the background. Designed to be cut out and placed on dark or light slides.

COLOR PALETTE: deep emerald green, dark forest green, bright neon emerald highlights for the coin / solid part. Crystal-clear transparent water with cool cyan-blue tint for the droplet and splashes. Pure white background. No other colors, no gold, no silver — strictly emerald + water.

STYLE: premium luxury product render, sleek conceptual design object — water transforming into measurable economic value. Octane / Redshift quality. Sharp focus throughout. No text, no logos, no numbers, no watermarks.`;

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

const dest = path.join(process.env.HOME, "Desktop", `drop-to-coin-${Date.now()}.jpg`);
await new Promise((resolve, reject) => {
  const file = fs.createWriteStream(dest);
  https.get(url, r => { r.pipe(file); file.on("finish", () => { file.close(); resolve(); }); }).on("error", reject);
});
console.log("[saved]", dest);
