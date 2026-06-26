// Sequential gen via curl — fixes parallel ECONNRESET and SDK issues on Windows.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = "C:/Users/Пользователь/Claude/smm-system";
const OUT_DIR = path.join(ROOT, "projects/Bioprintex_Limatex/posts/drafts/12_05_2026-1");
fs.mkdirSync(OUT_DIR, { recursive: true });

const envLine = fs.readFileSync(path.join(ROOT, ".env"), "utf8")
  .split("\n").find(l => l.startsWith("FAL_KEY="));
const FAL_KEY = envLine.slice("FAL_KEY=".length).trim();

function curlPost(body) {
  const tmpBody = path.join(OUT_DIR, ".body.json");
  fs.writeFileSync(tmpBody, JSON.stringify(body));
  const stdout = execFileSync("curl", [
    "-m", "180", "-s", "-X", "POST",
    "https://fal.run/fal-ai/nano-banana-2",
    "-H", `Authorization: Key ${FAL_KEY}`,
    "-H", "Content-Type: application/json",
    "--data-binary", `@${tmpBody}`,
  ], { maxBuffer: 8 * 1024 * 1024 });
  fs.unlinkSync(tmpBody);
  return JSON.parse(stdout.toString("utf8"));
}

function curlDownload(url, outPath) {
  execFileSync("curl", ["-m", "60", "-s", "-o", outPath, url]);
}

async function gen(name, prompt) {
  const t0 = Date.now();
  process.stdout.write(`→ ${name}: generating... `);
  try {
    const resp = curlPost({ prompt, image_size: "portrait_4_3", num_images: 1, resolution: "1K" });
    const url = resp?.images?.[0]?.url;
    if (!url) throw new Error("no url: " + JSON.stringify(resp).slice(0, 200));
    const out = path.join(OUT_DIR, `${name}.jpg`);
    curlDownload(url, out);
    const sz = fs.statSync(out).size;
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✓ ${(sz / 1024).toFixed(0)} KB, ${sec}s`);
    return { name, ok: true, path: out, size: sz, sec };
  } catch (e) {
    console.log(`✗ ${e.message}`);
    return { name, ok: false, error: e.message };
  }
}

const variants = [
  {
    name: "v1_documentary",
    prompt: "Documentary photojournalism style photograph of a Russian environmental scientist in a dark blue waterproof field jacket, kneeling at the muddy edge of a large industrial water reservoir. He is holding a transparent water sample tube up to natural overcast daylight. In his other hand: a portable digital pH/oxygen meter with a probe submerged in the water. Background: wide misty Russian lake, rusty pipes and a small research boat in the distance, low forest on the horizon. Realistic, gritty, unposed. Soft diffused overcast light, slightly cool color temperature. Authentic National Geographic feel. Portrait orientation 3:4. No corporate stock-photo look. No text. Highly detailed, sharp focus on the scientist and the sample.",
  },
  {
    name: "v2_cinematic",
    prompt: "Cinematic atmospheric close-up: a scientist's hands in dark blue nitrile gloves holding a small glass vial of clear water against an out-of-focus background of a foggy industrial reservoir at sunrise. The water sample catches a soft golden hour beam — light scatters through the liquid. Shallow depth of field, bokeh in the background. Mood: serious, precise, technological. Color grade: muted teal-and-amber, slight desaturation, subtle cinematic feel. Inspired by Apple product cinematography and Tesla brand visuals. No faces, no text. Portrait 3:4. Sharp focus on the vial. Subtle reflections in the water inside the vial.",
  },
  {
    name: "v3_editorial",
    prompt: "Editorial science magazine photograph, Nature or Wired aesthetic. Two-shot composition: on the left a precise water sampling device with a long stainless steel probe partially submerged in dark lake water; on the right a scientist (mid-30s, focused, wearing safety glasses and a navy field jacket, no visible text) reading values from a rugged digital display attached to the probe. Setting: a wooden pontoon on a still water surface, early morning, slight mist. Composition: clean, balanced, journalistic. Lighting: even, cold-neutral daylight. Subtle scientific instruments visible — clipboard, sample bottles in a foam case. Crisp, high-resolution, magazine-quality. Portrait 3:4. No text overlay. Detail-rich background.",
  },
  {
    name: "v4_aerial",
    prompt: "High-angle aerial drone photograph of a small research team working at the edge of a large industrial reservoir or eutrophic lake. From above: two people in navy field jackets standing on a wooden walkway, one operating a portable aeration prototype unit that floats on the water surface (matte dark grey with a blue accent stripe). Around them visible algal bloom patches contrasting with cleaner zones near the aerator (subtle, suggesting the device is working). A 4x4 vehicle and small camp visible at the corner. Top-down 3/4 aerial view. Cool overcast daylight, slightly desaturated. Modern drone-startup aesthetic — clean, technological, scale-emphasizing. Portrait 3:4. No text. High detail of water texture and equipment.",
  },
];

const results = [];
for (const v of variants) {
  results.push(await gen(v.name, v.prompt));
}

console.log("\n═══ summary ═══");
const ok = results.filter(r => r.ok).length;
console.log(`${ok}/${results.length} succeeded`);
