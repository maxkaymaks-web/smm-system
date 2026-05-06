import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import https from "https";

const envFile = fs.readFileSync(`${process.env.HOME}/.claude/.env.fal`, "utf8");
const FAL_KEY = envFile.match(/FAL_KEY=(.+)/)?.[1]?.trim();
fal.config({ credentials: FAL_KEY });

const SRC = "/Users/maxkaymaks/Desktop/карта-v3-1777984220267.png";
const OUT_DIR = "/Users/maxkaymaks/Desktop";

const buf = fs.readFileSync(SRC);
console.log(`[1/4] uploading...`);
const imageUrl = await fal.storage.upload(
  new Blob([buf], { type: "image/png" }),
  { contentType: "image/png" }
);
console.log(`[2/4] uploaded: ${imageUrl}`);

const prompt = `Edit this contour map of Russia. Keep absolutely everything unchanged — same projection, same position, same dimensions, same colors, same line style, all green regions stay green, all gray regions stay gray.

Make ONLY ONE change: ADD the Crimean Peninsula (Крым).

The Crimean Peninsula is currently missing from the map. Add it as a new gray region polygon (light gray fill #E8E8E8, thin dark gray border — same style as other inactive regions).

WHERE to draw Crimea:
- It must be a distinctive DIAMOND-SHAPED PENINSULA sticking out into the Black Sea
- Located in the southwest of the map, BELOW the existing southwestern gray regions (ДНР/ЛНР/Запорожье/Херсон) that were just added
- Connected to the mainland (to Kherson Oblast) by a thin narrow isthmus (Perekop) at its northern tip
- Surrounded by water on three sides (south, east, west) — the Black Sea on the west and south, Sea of Azov on the east
- Sevastopol is a tiny separate region on the southwestern corner of the Crimean peninsula — also draw it

Do NOT change anything else on the map. Do not move regions, do not recolor regions, do not redraw existing borders. Only ADD the Crimean peninsula and Sevastopol as new gray polygons in the empty water area below the existing southwestern regions.

Output: same map, identical in every way, but with Crimea peninsula now drawn.`;

console.log(`[3/4] editing...`);
let result;
try {
  result = await fal.subscribe("fal-ai/gpt-image-2/edit", {
    input: { prompt, image_urls: [imageUrl] },
    logs: true,
    onQueueUpdate: (u) => {
      if (u.status === "IN_PROGRESS") u.logs?.forEach((l) => console.log("[fal]", l.message));
    },
  });
} catch (err) {
  console.error("ERROR:", err.status, JSON.stringify(err.body || err.message, null, 2));
  process.exit(1);
}

const outImg = result.data?.images?.[0]?.url;
const outPath = path.join(OUT_DIR, `карта-v4-${Date.now()}.png`);
await new Promise((resolve, reject) => {
  const file = fs.createWriteStream(outPath);
  https.get(outImg, (r) => {
    r.pipe(file);
    file.on("finish", () => { file.close(); resolve(); });
  }).on("error", reject);
});
console.log(`SAVED: ${outPath}`);
