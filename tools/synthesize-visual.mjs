#!/usr/bin/env node
/**
 * synthesize-visual.mjs — synthesize visual analyses into design patterns + fal.ai prompts
 * Usage: node tools/synthesize-visual.mjs '<json_array_of_analyses>' '<style_name>' '<style_focus>' '<accounts>'
 * Output: JSON { patterns, color_palette, composition_rules, texture_lighting, fal_prompts }
 */

import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";

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

const [,, analysesJson, styleName = "", styleFocus = "", accounts = ""] = process.argv;

let analyses = [];
try {
  analyses = JSON.parse(analysesJson || "[]");
} catch {
  console.error(JSON.stringify({ error: "Invalid JSON for analyses" }));
  process.exit(1);
}

if (analyses.length === 0) {
  console.error(JSON.stringify({ error: "No analyses provided" }));
  process.exit(1);
}

// Build descriptions for each post
const descriptions = analyses.map((a, i) => {
  return `Post ${i + 1} (@${a.username || "?"} | ${(a.likes || 0).toLocaleString()} likes):
  Composition: ${a.composition || ""}
  Colors: ${a.colors || ""}
  Texture: ${a.texture || ""}
  Lighting: ${a.lighting || ""}
  Subject: ${a.subject || ""}
  Style category: ${a.style || ""}`;
}).join("\n\n");

const prompt = `You are a visual design trainer for social media designers.

Style being studied: ${styleName}
Accounts analyzed: ${accounts}
Design focus: ${styleFocus}

Here are visual analyses of ${analyses.length} top Instagram posts from these accounts:

${descriptions}

Based ONLY on visual patterns you observe across these posts, provide the following.
Respond in Russian for sections 1-4, in English for fal.ai prompts.
Use EXACTLY this format (one line per field):

PATTERN_1: [specific repeating visual element across posts]
PATTERN_2: [specific repeating visual element]
PATTERN_3: [specific repeating visual element]
PATTERN_4: [specific repeating visual element]
PATTERN_5: [specific repeating visual element]
COLOR_PALETTE: [dominant colors and how they are combined in this style]
COMPOSITION_RULES: [how these brands structure layout and focal points]
TEXTURE_LIGHTING: [signature texture, background style, and lighting approach]
FAL_PROMPT_1: [detailed generation prompt 25-35 words, recreating this visual style]
FAL_PROMPT_2: [variation with different subject, same aesthetic, 25-35 words]
FAL_PROMPT_3: [another variation, different angle or mood, 25-35 words]`;

try {
  const r = await fal.subscribe("fal-ai/any-llm", {
    input: {
      model: "google/gemini-flash-1.5",
      prompt,
    },
    logs: false,
  });

  const text = (r?.data?.output || r?.output || "").trim();

  const extract = (field) => {
    const m = text.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : "";
  };

  const patterns = [];
  for (let i = 1; i <= 5; i++) {
    const p = extract(`PATTERN_${i}`);
    if (p) patterns.push(p);
  }

  const result = {
    patterns,
    color_palette:      extract("COLOR_PALETTE"),
    composition_rules:  extract("COMPOSITION_RULES"),
    texture_lighting:   extract("TEXTURE_LIGHTING"),
    fal_prompts: [
      extract("FAL_PROMPT_1"),
      extract("FAL_PROMPT_2"),
      extract("FAL_PROMPT_3"),
    ].filter(Boolean),
    raw: text,
  };

  console.log(JSON.stringify(result));
} catch (err) {
  console.error(JSON.stringify({ error: String(err.message || err) }));
  process.exit(1);
}
