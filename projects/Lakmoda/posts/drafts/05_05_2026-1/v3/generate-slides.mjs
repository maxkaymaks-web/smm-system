import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOTAL = 4;
const slides = [
  {
    n: 1, photo: "photo_v3_1.jpg",
    mist: "bottom-right",
    tools: { file: "left", lamp: "bottom-right", stick: "top-right" },
    topKind: "subtle",
    topText: "три причины — и гарантия двадцать один день",
    bottomTitle: "Дело не в гель-лаке",
    bottomStyle: "hook",
  },
  {
    n: 2, photo: "photo_v3_2.jpg",
    mist: "top-left",
    tools: { file: "bottom-right", lamp: "top-left", stick: "right" },
    topKind: "numbered",
    topNumber: "01", topEyebrow: "причина",
    bottomTitle: "Подготовка пластины",
    bottomStyle: "main",
  },
  {
    n: 3, photo: "photo_v3_3.jpg",
    mist: "diagonal",
    tools: { file: "top", lamp: "right", stick: "bottom-left" },
    topKind: "numbered",
    topNumber: "02", topEyebrow: "причина",
    bottomTitle: "Слой и просушка",
    bottomStyle: "main",
  },
  {
    n: 4, photo: "photo_v3_4.jpg",
    mist: "centered-aura",
    tools: { file: "right", lamp: "bottom-left", stick: "top-left" },
    topKind: "numbered",
    topNumber: "03", topEyebrow: "причина",
    bottomTitle: "Уход после салона",
    bottomStyle: "main",
  },
];

function pad2(n) { return String(n).padStart(2, "0"); }

const TOOL_POSITIONS = {
  file: {
    left:           "top: 360px; left: 30px; transform: rotate(-32deg);",
    right:          "top: 360px; right: 30px; transform: rotate(32deg);",
    top:            "top: 220px; left: 50%; margin-left: -140px; transform: rotate(-6deg);",
    "bottom-right": "bottom: 180px; right: 35px; transform: rotate(28deg);",
  },
  lamp: {
    "top-left":     "top: 200px; left: 40px;",
    "top-right":    "top: 200px; right: 40px;",
    "bottom-left":  "bottom: 165px; left: 40px;",
    "bottom-right": "bottom: 165px; right: 40px;",
    right:          "top: 50%; right: 25px; margin-top: -120px;",
  },
  stick: {
    "top-right":    "top: 240px; right: 35px; transform: rotate(38deg);",
    "top-left":     "top: 240px; left: 35px; transform: rotate(-38deg);",
    right:          "top: 50%; right: 35px; margin-top: -10px; transform: rotate(8deg);",
    "bottom-left":  "bottom: 200px; left: 35px; transform: rotate(-42deg);",
    top:            "top: 230px; left: 50%; margin-left: -120px; transform: rotate(-4deg);",
  },
};

const MIST_LAYERS = {
  "bottom-right":
    "radial-gradient(ellipse 880px 880px at 82% 90%, rgba(244,212,210,0.55) 0%, rgba(244,212,210,0) 65%),",
  "top-left":
    "radial-gradient(ellipse 880px 880px at 16% 14%, rgba(244,212,210,0.55) 0%, rgba(244,212,210,0) 65%),",
  diagonal:
    "radial-gradient(ellipse 700px 700px at 14% 12%, rgba(244,212,210,0.50) 0%, rgba(244,212,210,0) 65%)," +
    "radial-gradient(ellipse 700px 700px at 86% 88%, rgba(244,212,210,0.45) 0%, rgba(244,212,210,0) 65%),",
  "centered-aura":
    "radial-gradient(ellipse 1100px 1100px at 50% 55%, rgba(244,212,210,0.45) 0%, rgba(244,212,210,0) 60%),",
};

const ORN = `
    <div class="orn">
      <span class="orn-line"></span>
      <span class="orn-diamond"></span>
      <span class="orn-line"></span>
    </div>`;

function topBlock(s) {
  if (s.topKind === "hook") {
    return `
  <div class="top-hook">
    ${ORN}
    <div class="top-hook-text">${s.topText}</div>
    ${ORN}
  </div>`;
  }
  if (s.topKind === "subtle") {
    return `
  <div class="top-hook is-subtle">
    ${ORN}
    <div class="top-subtle">${s.topText}</div>
    ${ORN}
  </div>`;
  }
  return `
  <div class="top-num">
    ${ORN}
    <div class="num">${s.topNumber}</div>
    <div class="num-eyebrow">${s.topEyebrow}</div>
    ${ORN}
  </div>`;
}

function bottomBlock(s) {
  if (s.bottomStyle === "subtle") {
    return `
  <div class="bottom-block">
    ${ORN}
    <div class="bottom-subtle">${s.bottomTitle}</div>
  </div>`;
  }
  if (s.bottomStyle === "hook") {
    return `
  <div class="bottom-block">
    ${ORN}
    <div class="bottom-hook">${s.bottomTitle}</div>
    ${ORN}
  </div>`;
  }
  return `
  <div class="bottom-block">
    ${ORN}
    <div class="bottom-title">${s.bottomTitle}</div>
    ${ORN}
  </div>`;
}

function html(s) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Lakmoda — слайд v3.${s.n}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1080px; height: 1350px; overflow: hidden;
    position: relative;
    font-family: 'Montserrat', system-ui, sans-serif;
    background:
      radial-gradient(ellipse 1200px 900px at 24% 18%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 62%),
      radial-gradient(ellipse 700px 500px at 70% 30%, rgba(255,228,222,0.45) 0%, rgba(255,228,222,0) 60%),
      radial-gradient(ellipse 600px 500px at 25% 70%, rgba(228,232,250,0.40) 0%, rgba(228,232,250,0) 60%),
      ${MIST_LAYERS[s.mist]}
      linear-gradient(165deg, #fbfaf6 0%, #f7f3ee 45%, #f3ebe6 100%);
  }

  body::before {
    content: "";
    position: absolute; inset: 0;
    background-image: radial-gradient(rgba(150, 110, 100, 0.06) 1px, transparent 1.3px);
    background-size: 14px 14px;
    mix-blend-mode: multiply;
    opacity: 0.40;
    pointer-events: none;
    z-index: 1;
  }

  body::after {
    content: "";
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 500px 350px at 75% 28%, rgba(255, 250, 248, 0.55) 0%, transparent 60%),
      radial-gradient(ellipse 460px 340px at 28% 72%, rgba(255, 252, 250, 0.50) 0%, transparent 60%);
    pointer-events: none;
    z-index: 2;
  }

  .vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 55%, rgba(220, 200, 195, 0.18) 100%);
    z-index: 9;
    pointer-events: none;
  }

  /* tool silhouettes */
  .tool {
    position: absolute;
    opacity: 0.22;
    z-index: 3;
    pointer-events: none;
    filter: blur(0.6px);
  }
  .tool.file  { width: 280px; ${TOOL_POSITIONS.file[s.tools.file]} }
  .tool.lamp  { width: 240px; ${TOOL_POSITIONS.lamp[s.tools.lamp]} }
  .tool.stick { width: 240px; ${TOOL_POSITIONS.stick[s.tools.stick]} }

  /* ====== CIRCLE ====== */
  /* outermost hairline — едва заметная, придаёт глубину */
  .ring-outermost {
    position: absolute;
    width: 904px; height: 904px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 0.8px solid rgba(199, 152, 144, 0.22);
    z-index: 4;
    pointer-events: none;
  }
  /* main dust-rose ring */
  .ring-outer {
    position: absolute;
    width: 860px; height: 860px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 1.5px solid rgba(199, 152, 144, 0.62);
    z-index: 5;
    pointer-events: none;
  }
  /* inner pearl hairline + glow */
  .ring-inner {
    position: absolute;
    width: 822px; height: 822px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.90);
    box-shadow:
      0 0 34px 5px rgba(255, 255, 255, 0.55),
      inset 0 0 14px rgba(255, 255, 255, 0.50);
    z-index: 6;
    pointer-events: none;
  }
  /* glass disc — photo */
  .disc {
    position: absolute;
    width: 800px; height: 800px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    overflow: hidden;
    z-index: 7;
    box-shadow:
      0 50px 110px rgba(170, 130, 125, 0.22),
      0 18px 45px rgba(170, 130, 125, 0.14),
      inset 0 0 0 2px rgba(255, 255, 255, 0.78),
      inset 0 0 80px rgba(255, 255, 255, 0.18);
  }
  .disc img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* ====== TEXT BLOCKS ====== */
  /* ornament — двойная тонкая линия с ромбиком, журнальный приём */
  .orn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 11px;
    margin: 14px auto;
  }
  .orn-line {
    width: 90px; height: 1.5px;
    background: linear-gradient(to right, transparent 0%, rgba(180, 128, 118, 1) 30%, rgba(180, 128, 118, 1) 70%, transparent 100%);
    display: inline-block;
  }
  .orn-diamond {
    width: 8px; height: 8px;
    background: rgba(160, 105, 95, 1);
    transform: rotate(45deg);
    display: inline-block;
    box-shadow: 0 0 8px rgba(199, 152, 144, 0.6);
  }

  .top-hook {
    position: absolute;
    top: 78px; left: 0; right: 0;
    text-align: center;
    z-index: 8;
    color: #131e29;
  }
  .top-hook.is-subtle { top: 118px; }
  .top-hook-text {
    font-weight: 400;
    font-size: 54px;
    line-height: 1.12;
    letter-spacing: 0.3px;
    color: #131e29;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  .top-num {
    position: absolute;
    top: 28px; left: 0; right: 0;
    text-align: center;
    z-index: 8;
  }
  .num {
    font-weight: 200;
    font-size: 130px;
    line-height: 1;
    color: rgba(180, 122, 110, 0.92);
    letter-spacing: -1px;
    font-feature-settings: "lnum";
    text-shadow: 0 2px 8px rgba(199, 152, 144, 0.25);
  }
  .num-eyebrow {
    margin-top: 6px;
    font-weight: 600;
    font-size: 17px;
    letter-spacing: 13px;
    text-transform: uppercase;
    color: rgba(155, 100, 90, 0.95);
    padding-left: 13px;
  }

  .bottom-block {
    position: absolute;
    bottom: 118px; left: 0; right: 0;
    text-align: center;
    z-index: 8;
  }
  .bottom-title {
    font-weight: 400;
    font-size: 44px;
    line-height: 1.18;
    color: #0f1a25;
    letter-spacing: 0.4px;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .bottom-subtle {
    font-weight: 500;
    font-size: 22px;
    line-height: 1.4;
    color: rgba(15, 26, 37, 0.82);
    letter-spacing: 2.2px;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  .top-subtle {
    font-weight: 600;
    font-size: 28px;
    line-height: 1.35;
    color: #0a141e;
    letter-spacing: 1.6px;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .bottom-hook {
    font-weight: 400;
    font-size: 38px;
    line-height: 1.18;
    color: #0f1a25;
    letter-spacing: 0.4px;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  .brand {
    position: absolute;
    left: 0; right: 0;
    bottom: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    font-family: 'Montserrat', system-ui, sans-serif;
    font-weight: 400;
    font-size: 24px;
    letter-spacing: 14px;
    color: #0a141e;
    z-index: 8;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .brand-text { padding-left: 12px; }
  .brand-dot {
    width: 5px; height: 5px;
    background: rgba(160, 105, 95, 1);
    border-radius: 50%;
    box-shadow: 0 0 5px rgba(199, 152, 144, 0.55);
  }
  /* discreet URL под wordmark */
  .url-line {
    position: absolute;
    left: 0; right: 0;
    bottom: 32px;
    text-align: center;
    font-family: 'Montserrat', sans-serif;
    font-weight: 500;
    font-size: 16px;
    letter-spacing: 5.5px;
    text-transform: lowercase;
    color: rgba(95, 50, 40, 1);
    z-index: 8;
    padding-left: 5px;
  }

  /* ===== TREND: corner brackets как passe-partout ===== */
  .frame-corner {
    position: absolute;
    width: 38px; height: 38px;
    border: 1.5px solid rgba(180, 128, 118, 0.85);
    z-index: 8;
    pointer-events: none;
  }
  .frame-corner.tl { top: 50px; left:  50px; border-right: 0; border-bottom: 0; }
  .frame-corner.tr { top: 50px; right: 50px; border-left:  0; border-bottom: 0; }
  .frame-corner.bl { bottom: 50px; left:  50px; border-right: 0; border-top: 0; }
  .frame-corner.br { bottom: 50px; right: 50px; border-left:  0; border-top: 0; }

  /* ===== TREND: meta-stamps в углах рамки ===== */
  .meta {
    position: absolute;
    font-family: 'Montserrat', sans-serif;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 5px;
    text-transform: uppercase;
    color: rgba(105, 55, 45, 1);
    z-index: 9;
    padding-left: 5px;
    white-space: nowrap;
  }
  .meta.tl { top: 62px; left:  100px; }

  /* ===== TREND: micro-sparkles ===== */
  .sparkle {
    position: absolute;
    width: 26px; height: 26px;
    z-index: 5;
    pointer-events: none;
    opacity: 0.9;
    filter: drop-shadow(0 0 4px rgba(199, 152, 144, 0.4));
  }
  .sparkle.s1 { top: 18%;  left:  7%;  }
  .sparkle.s2 { top: 11%;  right: 9%; width: 20px; height: 20px; opacity: 0.75; }
  .sparkle.s3 { bottom: 22%; right: 6%; }
  .sparkle.s4 { bottom: 13%; left:  8%; width: 19px; height: 19px; opacity: 0.75; }
</style>
</head>
<body>
  <!-- TOOL: nail file -->
  <svg class="tool file" viewBox="0 0 280 50" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fileGrad${s.n}" x1="0" x2="1">
        <stop offset="0%" stop-color="#c89189"/>
        <stop offset="50%" stop-color="#d9a8a0"/>
        <stop offset="100%" stop-color="#c89189"/>
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="268" height="38" rx="19" ry="19" fill="url(#fileGrad${s.n})"/>
    <rect x="6" y="6" width="268" height="38" rx="19" ry="19" fill="none" stroke="rgba(170,110,100,0.40)" stroke-width="1"/>
    <g stroke="rgba(140,85,75,0.28)" stroke-width="0.6">
      <line x1="40" y1="14" x2="48" y2="36"/><line x1="60" y1="12" x2="68" y2="38"/>
      <line x1="80" y1="14" x2="88" y2="36"/><line x1="100" y1="12" x2="108" y2="38"/>
      <line x1="120" y1="14" x2="128" y2="36"/><line x1="140" y1="12" x2="148" y2="38"/>
      <line x1="160" y1="14" x2="168" y2="36"/><line x1="180" y1="12" x2="188" y2="38"/>
      <line x1="200" y1="14" x2="208" y2="36"/><line x1="220" y1="12" x2="228" y2="38"/>
    </g>
  </svg>

  <!-- TOOL: UV lamp -->
  <svg class="tool lamp" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lampGrad${s.n}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#d9a8a0"/>
        <stop offset="100%" stop-color="#b88078"/>
      </linearGradient>
    </defs>
    <path d="M 30 130 Q 30 30 120 30 Q 210 30 210 130 L 210 165 L 30 165 Z"
          fill="url(#lampGrad${s.n})" stroke="rgba(170,110,100,0.40)" stroke-width="1"/>
    <ellipse cx="120" cy="160" rx="80" ry="14" fill="rgba(180,110,100,0.32)"/>
    <rect x="50" y="170" width="140" height="36" rx="10" fill="url(#lampGrad${s.n})" stroke="rgba(170,110,100,0.40)" stroke-width="1"/>
    <rect x="80" y="206" width="80" height="14" rx="6" fill="#b88078" opacity="0.8"/>
    <circle cx="120" cy="146" r="3" fill="rgba(255,240,220,0.55)"/>
  </svg>

  <!-- TOOL: orange wood stick -->
  <svg class="tool stick" viewBox="0 0 240 30" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="stickGrad${s.n}" x1="0" x2="1">
        <stop offset="0%" stop-color="#c2837a"/>
        <stop offset="100%" stop-color="#d9a8a0"/>
      </linearGradient>
    </defs>
    <path d="M 4 14 L 215 8 L 232 14 L 215 22 L 4 16 Z" fill="url(#stickGrad${s.n})" stroke="rgba(170,110,100,0.36)" stroke-width="0.8"/>
    <line x1="4" y1="14" x2="14" y2="9" stroke="rgba(170,110,100,0.36)" stroke-width="0.6"/>
    <line x1="4" y1="16" x2="14" y2="21" stroke="rgba(170,110,100,0.36)" stroke-width="0.6"/>
  </svg>
  ${topBlock(s)}

  <div class="ring-outermost"></div>
  <div class="ring-outer"></div>
  <div class="ring-inner"></div>
  <div class="disc">
    <img src="${s.photo}" alt="manicure"/>
  </div>
  ${bottomBlock(s)}

  <!-- frame corners + meta-stamps -->
  <div class="frame-corner tl"></div>
  <div class="frame-corner tr"></div>
  <div class="frame-corner bl"></div>
  <div class="frame-corner br"></div>
  <div class="meta tl">lakmoda.ru</div>

  <!-- micro-sparkles (4-point stars) -->
  <svg class="sparkle s1" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M 10 0 L 11.2 8.8 L 20 10 L 11.2 11.2 L 10 20 L 8.8 11.2 L 0 10 L 8.8 8.8 Z" fill="rgba(180, 128, 118, 0.9)"/>
  </svg>
  <svg class="sparkle s2" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M 10 0 L 11.2 8.8 L 20 10 L 11.2 11.2 L 10 20 L 8.8 11.2 L 0 10 L 8.8 8.8 Z" fill="rgba(180, 128, 118, 0.85)"/>
  </svg>
  <svg class="sparkle s3" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M 10 0 L 11.2 8.8 L 20 10 L 11.2 11.2 L 10 20 L 8.8 11.2 L 0 10 L 8.8 8.8 Z" fill="rgba(180, 128, 118, 0.9)"/>
  </svg>
  <svg class="sparkle s4" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M 10 0 L 11.2 8.8 L 20 10 L 11.2 11.2 L 10 20 L 8.8 11.2 L 0 10 L 8.8 8.8 Z" fill="rgba(180, 128, 118, 0.85)"/>
  </svg>

  <div class="vignette"></div>
  <div class="brand">
    <span class="brand-dot"></span>
    <span class="brand-text">LAKMODA</span>
    <span class="brand-dot"></span>
  </div>
  <div class="url-line">люберцы · лермонтовский&nbsp;пр-т</div>
</body>
</html>
`;
}

for (const s of slides) {
  const out = path.join(__dirname, `slide_v3_${s.n}.html`);
  fs.writeFileSync(out, html(s));
  console.log(`✓ ${path.basename(out)}`);
}
console.log("Done");
