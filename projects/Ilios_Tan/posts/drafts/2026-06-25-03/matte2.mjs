import sharp from 'sharp';

const files = ['strokes', 'confetti'];

for (const f of files) {
  const img = sharp(`${f}.jpg`).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const brightness = (r + g + b) / 3;
    let alpha = 255;
    if (brightness > 232) {
      alpha = 0;
    } else if (brightness > 195) {
      alpha = Math.round(255 * (1 - (brightness - 195) / 37));
      if (alpha < 0) alpha = 0;
    }
    data[idx + 3] = alpha;
  }
  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(`${f}.png`);
  console.log('matted', f);
}
