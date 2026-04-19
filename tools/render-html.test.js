// tools/render-html.test.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT = '/tmp/test-post-output.png';

// Clean up before test
if (fs.existsSync(OUTPUT)) fs.unlinkSync(OUTPUT);

try {
  execSync(`node ${path.join(__dirname, 'render-html.js')} /tmp/test-post.html ${OUTPUT}`, {
    stdio: 'inherit'
  });
} catch (e) {
  console.error('FAIL: render command failed');
  process.exit(1);
}

if (!fs.existsSync(OUTPUT)) {
  console.error('FAIL: output PNG not created');
  process.exit(1);
}

const size = fs.statSync(OUTPUT).size;
if (size < 1000) {
  console.error(`FAIL: PNG too small (${size} bytes) — likely empty`);
  process.exit(1);
}

console.log(`PASS: PNG created at ${OUTPUT} (${size} bytes)`);
