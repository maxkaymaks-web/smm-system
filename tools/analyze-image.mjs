#!/usr/bin/env node
/**
 * analyze-image.mjs — visual analysis of a local image via fal.ai vision
 * Usage: node tools/analyze-image.mjs <local_path> <style_name> <style_focus>
 * Output: JSON with visual analysis fields
 */

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

// Load FAL_KEY
const envPath = path.join(process.env.HOME, ".claude/.env.fal");
let FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY && fs.existsSync(envPath)) {
  FAL_KEY = fs.readFileSync(envPath, "utf-8").match(/FAL_KEY=(.+)/)?.[1]?.trim();
}
if (!FAL_KEY) {
  console.error(JSON.stringify({ error: "FAL_KEY not found" }));
  process.exit(1);
}
fal.config({ credentials: FAL_KEY });

const [,, localPath, styleName = "unknown", styleFocus = "visual design"] = process.argv;

if (!localPath || !fs.existsSync(localPath)) {
  console.error(JSON.stringify({ error: `File not found: ${localPath}` }));
  process.exit(1);
}

// Upload local file to fal storage
const imgData = fs.readFileSync(localPath);
const blob = new Blob([imgData], { type: "image/jpeg" });
const file = new File([blob], path.basename(localPath), { type: "image/jpeg" });
const uploadUrl = await fal.storage.upload(file);

const prompt = `You are a visual design expert studying Instagram posts for the brand style "${styleName}". Focus: ${styleFocus}

Analyze this image VISUALLY ONLY — ignore any text overlaid on the image.

Respond ONLY in this exact format (one line per field, no extra text):
COMPOSITION: [layout type, focal point placement, negative space usage]
COLORS: [list 3-4 dominant colors with descriptive names, overall mood]
TEXTURE: [background character — clean/grained/photographic/abstract, surface quality]
LIGHTING: [direction and quality — natural/studio/golden hour/rim light, contrast level]
SUBJECT: [main visual element, crop style, framing technique]
STYLE_CATEGORY: [editorial/luxury/lifestyle/product/abstract/bold — pick one]
FAL_PROMPT_1: [detailed fal.ai generation prompt in English recreating this visual aesthetic, 20-30 words]
FAL_PROMPT_2: [variation prompt with different subject but same aesthetic, 20-30 words]`;

try {
  const r = await fal.subscribe("fal-ai/any-llm/vision", {
    input: {
      model: "google/gemini-flash-1.5",
      prompt,
      image_url: uploadUrl,
    },
    logs: false,
  });

  const text = (r?.data?.output || r?.output || "").trim();

  const extract = (field) => {
    const m = text.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : "";
  };

  const result = {
    composition:   extract("COMPOSITION"),
    colors:        extract("COLORS"),
    texture:       extract("TEXTURE"),
    lighting:      extract("LIGHTING"),
    subject:       extract("SUBJECT"),
    style:         extract("STYLE_CATEGORY"),
    fal_prompt_1:  extract("FAL_PROMPT_1"),
    fal_prompt_2:  extract("FAL_PROMPT_2"),
    raw:           text,
  };

  console.log(JSON.stringify(result));
} catch (err) {
  console.error(JSON.stringify({ error: String(err.message || err) }));
  process.exit(1);
}
