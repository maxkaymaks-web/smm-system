import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Point to ffmpeg-static binary
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_BINARY = ffmpegPath;

const entryPoint = path.join(__dirname, 'src', 'Root.jsx');
const outputFile = 'C:/Users/Пользователь/Desktop/lakmoda-may-reel.mp4';

console.log('📦 Bundling Remotion project...');
const bundleLocation = await bundle({
  entryPoint,
  // Serve static files from public/ folder
  webpackOverride: (config) => config,
  publicDir: path.join(__dirname, 'public'),
});

console.log('🎬 Selecting composition...');
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'LakmodaReel',
  inputProps: {},
});

console.log(`▶️  Rendering: ${composition.durationInFrames} frames @ ${composition.fps}fps`);
console.log(`   Size: ${composition.width}×${composition.height}`);

await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: outputFile,
  ffmpegBinary: ffmpegPath,
  onProgress: ({ progress, renderedFrames, encodedFrames }) => {
    const pct = Math.round(progress * 100);
    process.stdout.write(`\r   Progress: ${pct}% (rendered ${renderedFrames}, encoded ${encodedFrames})`);
  },
  chromiumOptions: {
    disableWebSecurity: true,
  },
  logLevel: 'warn',
});

console.log('\n✅ Done! Saved to:', outputFile);
