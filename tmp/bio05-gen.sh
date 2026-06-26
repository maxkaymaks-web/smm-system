#!/bin/bash
# Direct REST gen for fal-ai/nano-banana-2 — bypassing SDK that has ECONNRESET on Windows
set -e
FAL_KEY=$(grep '^FAL_KEY=' "C:/Users/Пользователь/Claude/smm-system/.env" | cut -d= -f2)
OUT_DIR="C:/Users/Пользователь/Claude/smm-system/projects/Bioprintex_Limatex/posts/drafts/12_05_2026-1"
mkdir -p "$OUT_DIR"

gen() {
  local name="$1"
  local prompt="$2"
  echo "→ $name: generating..."
  local resp
  resp=$(curl -m 120 -s -X POST "https://fal.run/fal-ai/nano-banana-2" \
    -H "Authorization: Key $FAL_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg p "$prompt" '{prompt:$p, image_size:"portrait_4_3", num_images:1, resolution:"1K"}')")
  local url
  url=$(echo "$resp" | jq -r '.images[0].url // empty')
  if [ -z "$url" ]; then
    echo "✗ $name FAILED: $resp"
    return 1
  fi
  curl -m 60 -s -o "$OUT_DIR/$name.jpg" "$url"
  echo "✓ $name: $OUT_DIR/$name.jpg ($(stat -c %s "$OUT_DIR/$name.jpg" 2>/dev/null || wc -c < "$OUT_DIR/$name.jpg") bytes)"
}

# 4 stylistic variants — generated in parallel via & + wait
gen v1_documentary "Documentary photojournalism style photograph of a Russian environmental scientist in a dark blue waterproof field jacket, kneeling at the muddy edge of a large industrial water reservoir. He is holding a transparent water sample tube up to natural overcast daylight. In his other hand: a portable digital pH oxygen meter with a probe submerged in the water. Background: wide misty Russian lake, rusty pipes and a small research boat in the distance, low forest on the horizon. Realistic, gritty, unposed. Soft diffused overcast light, slightly cool color temperature. Authentic National Geographic feel. Portrait orientation 3:4. No corporate stock-photo look. No text. Highly detailed, sharp focus on the scientist and the sample." &
PID1=$!

gen v2_cinematic "Cinematic atmospheric close-up: a scientist's hands in dark blue nitrile gloves holding a small glass vial of clear water against an out-of-focus background of a foggy industrial reservoir at sunrise. The water sample catches a soft golden hour beam — light scatters through the liquid. Shallow depth of field, bokeh in the background. Mood: serious, precise, technological. Color grade: muted teal-and-amber, slight desaturation, subtle cinematic feel. Inspired by Apple product cinematography and Tesla brand visuals. No faces, no text. Portrait 3:4. Sharp focus on the vial. Subtle reflections in the water inside the vial." &
PID2=$!

gen v3_editorial "Editorial science magazine photograph, Nature or Wired aesthetic. Two-shot composition: on the left a precise water sampling device with a long stainless steel probe partially submerged in dark lake water; on the right a scientist (mid-30s, focused, wearing safety glasses and a navy field jacket, no visible text) reading values from a rugged digital display attached to the probe. Setting: a wooden pontoon on a still water surface, early morning, slight mist. Composition: clean, balanced, journalistic. Lighting: even, cold-neutral daylight. Subtle scientific instruments visible — clipboard, sample bottles in a foam case. Crisp, high-resolution, magazine-quality. Portrait 3:4. No text overlay. Detail-rich background." &
PID3=$!

gen v4_aerial "High-angle aerial drone photograph of a small research team working at the edge of a large industrial reservoir or eutrophic lake. From above: two people in navy field jackets standing on a wooden walkway, one operating a portable aeration prototype unit that floats on the water surface (matte dark grey with a blue accent stripe). Around them visible algal bloom patches contrasting with cleaner zones near the aerator (subtle, suggesting the device is working). A 4x4 vehicle and small camp visible at the corner. Top-down 3/4 aerial view. Cool overcast daylight, slightly desaturated. Modern drone-startup aesthetic — clean, technological, scale-emphasizing. Portrait 3:4. No text. High detail of water texture and equipment." &
PID4=$!

wait $PID1 $PID2 $PID3 $PID4
echo "═══ all 4 done ═══"
