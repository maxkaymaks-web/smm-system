/**
 * Two-pass ffmpeg vidstab stabilization for all 4 Lakmoda clips.
 * Outputs stabilized MP4s to public/stable_*.mp4
 */

import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

const publicDir = path.join(__dirname, 'public');
// Use relative paths for trf files to avoid ffmpeg path parsing issues
const tmpDir = '.';

const clips = [
  'IMG_5828.MOV',
  'IMG_0550.MOV',
  'IMG_0406.MOV',
  'IMG_6520.MOV',
];

function run(args, label) {
  const result = spawnSync(ffmpeg, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(`❌ Error in ${label}:`);
    console.error(result.stderr?.slice(-800));
    process.exit(1);
  }
  return result;
}

for (let i = 0; i < clips.length; i++) {
  const clip = clips[i];
  const input = path.join(publicDir, clip).replace(/\\/g, '/');
  // Relative path - no absolute path to avoid ffmpeg filter parser issues
  const trf = `stab${i}.trf`;
  const output = path.join(publicDir, `stable_${clip.replace('.MOV', '.mp4')}`).replace(/\\/g, '/');

  console.log(`\n📹 Stabilizing ${clip}...`);

  // Pass 1: detect
  console.log('  Pass 1: detecting shakes...');
  run([
    '-y', '-i', input,
    '-vf', `vidstabdetect=shakiness=8:accuracy=15:result=${trf}`,
    '-f', 'null', '-'
  ], `${clip} pass1`);

  // Pass 2: transform
  console.log('  Pass 2: applying stabilization...');
  run([
    '-y', '-i', input,
    '-vf', `vidstabtransform=input=${trf}:zoom=3:smoothing=25:crop=black,unsharp=3:3:0.5:3:3:0.0`,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-an',
    output
  ], `${clip} pass2`);

  console.log(`  ✅ Saved: stable_${clip.replace('.MOV', '.mp4')}`);
}

console.log('\n🎉 All clips stabilized!');
