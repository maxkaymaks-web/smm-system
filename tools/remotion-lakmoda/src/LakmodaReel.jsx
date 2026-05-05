import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
  Easing,
} from 'remotion';

// Lakmoda brand
const POWDER  = '#fecabd';
const POWDER2 = '#f5d8d0';
const CREAM   = '#fdf4f1';
const NAVY    = '#2f4150';
const NAVY2   = '#3d5264';
const WHITE   = '#ffffff';
const FPS     = 30;

// Shot durations @ 30fps — 4s each (120 frames)
// Stabilized files, playbackRate=0.6 → ~2.4s of source shown in 4s
const SHOTS = [
  { file: 'stable_IMG_5828.mp4', from: 0, dur: 120, rate: 0.55 }, // молочно-розовое
  { file: 'stable_IMG_0550.mp4', from: 0, dur: 120, rate: 0.60 }, // цветной лак
  { file: 'stable_IMG_0406.mp4', from: 0, dur: 120, rate: 0.60 }, // кисточка
  { file: 'stable_IMG_6520.mp4', from: 0, dur: 120, rate: 0.60 }, // стразы
];

// Caption per shot
const CAPTIONS = [
  'весна на кончиках пальцев',
  'каждый оттенок — настроение',
  'детали, которые замечают',
  'работа, которой гордятся',
];

const TOTAL_CLIPS_FRAMES = SHOTS.reduce((s, sh) => s + sh.dur, 0); // 480
const TITLE_FRAMES = 75;  // 2.5s logo card
export const TOTAL_FRAMES = TOTAL_CLIPS_FRAMES + TITLE_FRAMES; // 555

// ─── Clip ─────────────────────────────────────────────────────────────────────
function Clip({ file, startFrom, playbackRate, caption }) {
  const frame = useCurrentFrame();
  const fadeDur = 10;

  const opacity = interpolate(frame, [0, fadeDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  // Caption: fade in quickly, stay long, fade out near end
  const captionOpacity = interpolate(
    frame,
    [fadeDur, fadeDur + 8, 90, 108],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ background: '#000', opacity }}>

      {/* Video — scale to fill 9:16, colour corrected */}
      <div style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <OffthreadVideo
          src={staticFile(file)}
          startFrom={startFrom}
          playbackRate={playbackRate}
          style={{
            height: '100%',
            width: 'auto',
            minWidth: '100%',
            objectFit: 'cover',
            // Color grading: punchy spring palette
            filter: 'brightness(1.08) contrast(1.18) saturate(1.28)',
          }}
          muted
        />
      </div>

      {/* Warm vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 55%, rgba(15,10,8,0.35) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Dark gradient bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 360,
        background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 100%)',
      }} />

      {/* LAKMODA badge — top right */}
      <div style={{
        position: 'absolute', top: 56, right: 44,
        background: 'rgba(253,244,241,0.18)',
        border: `1px solid ${POWDER}99`,
        borderRadius: 40,
        padding: '9px 20px',
        fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
        fontSize: 26,
        letterSpacing: '0.15em',
        color: POWDER,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        LAKMODA
      </div>

      {/* Caption — bottom, long display */}
      <div style={{
        position: 'absolute', bottom: 96, left: 48, right: 48,
        opacity: captionOpacity,
        fontFamily: '"Raleway", "Georgia", serif',
        fontWeight: 300,
        fontSize: 36,
        color: WHITE,
        letterSpacing: '0.06em',
        textAlign: 'center',
        textShadow: '0 2px 14px rgba(0,0,0,0.55)',
        lineHeight: 1.3,
      }}>
        {caption}
      </div>

    </AbsoluteFill>
  );
}

// ─── Title Card ───────────────────────────────────────────────────────────────
function TitleCard() {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  const logoY = interpolate(frame, [0, 22], [28, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.15)),
  });

  const taglineY = interpolate(frame, [10, 30], [16, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  const taglineOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const urlY = interpolate(frame, [20, 42], [18, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  const urlOpacity = interpolate(frame, [20, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      // Soft powder-to-cream gradient — нежный, feminine
      background: `linear-gradient(175deg, ${CREAM} 0%, ${POWDER2} 38%, ${POWDER} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: fadeIn,
    }}>

      {/* Subtle grain texture */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.06, pointerEvents:'none' }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)"/>
      </svg>

      {/* Fine dot pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle, ${NAVY}18 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
        pointerEvents: 'none',
      }} />

      {/* Top decorative lines */}
      <div style={{ position:'absolute', top:170, left:0, right:0, display:'flex', flexDirection:'column', gap:6, alignItems:'stretch', padding:'0 100px' }}>
        <div style={{ height:1, background:`linear-gradient(90deg, transparent, ${NAVY}30, ${NAVY}55, ${NAVY}30, transparent)` }}/>
        <div style={{ height:1, background:`linear-gradient(90deg, transparent, ${NAVY}15, ${NAVY}30, ${NAVY}15, transparent)`, marginTop:5 }}/>
      </div>

      {/* Flower / petals motif — SVG */}
      <svg style={{ position:'absolute', top:210, left:'50%', transform:'translateX(-50%)', opacity:0.12, width:220, height:30 }}
           viewBox="0 0 220 30" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="15" x2="88" y2="15" stroke={NAVY} strokeWidth="0.8"/>
        <circle cx="110" cy="15" r="8" fill="none" stroke={NAVY} strokeWidth="1"/>
        <circle cx="110" cy="15" r="3" fill={NAVY}/>
        <line x1="132" y1="15" x2="220" y2="15" stroke={NAVY} strokeWidth="0.8"/>
        <line x1="110" y1="0" x2="110" y2="7" stroke={NAVY} strokeWidth="0.8"/>
        <line x1="110" y1="23" x2="110" y2="30" stroke={NAVY} strokeWidth="0.8"/>
      </svg>

      {/* Main logo */}
      <div style={{
        transform: `translateY(${logoY}px)`,
        fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
        fontSize: 118,
        letterSpacing: '0.20em',
        color: NAVY,
        lineHeight: 1,
        textAlign: 'center',
        textShadow: `0 2px 20px ${NAVY}22`,
        marginTop: 32,
      }}>
        LAKMODA
      </div>

      {/* Tagline */}
      <div style={{
        transform: `translateY(${taglineY}px)`,
        opacity: taglineOpacity,
        marginTop: 14,
        fontFamily: '"Raleway", "Georgia", serif',
        fontWeight: 300,
        fontSize: 28,
        color: NAVY2,
        letterSpacing: '0.30em',
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        маникюр · педикюр
      </div>

      {/* Thin divider */}
      <div style={{
        marginTop: 40,
        width: 48,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${NAVY}60, transparent)`,
      }}/>

      {/* URL pill */}
      <div style={{
        marginTop: 36,
        transform: `translateY(${urlY}px)`,
        opacity: urlOpacity,
        fontFamily: '"Raleway", "Georgia", serif',
        fontWeight: 500,
        fontSize: 30,
        color: NAVY,
        letterSpacing: '0.10em',
        border: `1.5px solid ${NAVY}55`,
        borderRadius: 50,
        padding: '13px 42px',
        textAlign: 'center',
        background: `${WHITE}55`,
        backdropFilter: 'blur(4px)',
      }}>
        lakmoda.ru
      </div>

      {/* Bottom decorative lines */}
      <div style={{ position:'absolute', bottom:170, left:0, right:0, display:'flex', flexDirection:'column', gap:6, alignItems:'stretch', padding:'0 100px' }}>
        <div style={{ height:1, background:`linear-gradient(90deg, transparent, ${NAVY}30, ${NAVY}55, ${NAVY}30, transparent)` }}/>
        <div style={{ height:1, background:`linear-gradient(90deg, transparent, ${NAVY}15, ${NAVY}30, ${NAVY}15, transparent)`, marginTop:5 }}/>
      </div>

    </AbsoluteFill>
  );
}

// ─── Main composition ─────────────────────────────────────────────────────────
export function LakmodaReel() {
  let offset = 0;
  const sequences = SHOTS.map((shot, i) => {
    const el = (
      <Sequence key={i} from={offset} durationInFrames={shot.dur}>
        <Clip
          file={shot.file}
          startFrom={shot.from}
          playbackRate={shot.rate}
          caption={CAPTIONS[i]}
        />
      </Sequence>
    );
    offset += shot.dur;
    return el;
  });

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {sequences}

      <Sequence from={TOTAL_CLIPS_FRAMES} durationInFrames={TITLE_FRAMES}>
        <TitleCard />
      </Sequence>

      <Audio src={staticFile('music.wav')} />
    </AbsoluteFill>
  );
}
