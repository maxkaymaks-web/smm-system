import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';

// Lakmoda brand
const POWDER = '#fecabd';
const NAVY   = '#2f4150';
const WHITE  = '#ffffff';
const FPS    = 30;

// Shot durations in frames @ 30fps
const SHOTS = [
  { file: 'IMG_5828.MOV', from: 0,  dur: 78  }, // 2.6s — молочно-розовое покрытие
  { file: 'IMG_0550.MOV', from: 0,  dur: 66  }, // 2.2s — нанесение цветного лака
  { file: 'IMG_0406.MOV', from: 0,  dur: 72  }, // 2.4s — работа кисточкой
  { file: 'IMG_6520.MOV', from: 0,  dur: 72  }, // 2.4s — дизайн со стразами
];

// Caption per shot
const CAPTIONS = [
  'весна на кончиках пальцев',
  'каждый оттенок — настроение',
  'детали, которые замечают',
  'работа, которой гордятся',
];

const TOTAL_CLIPS_FRAMES = SHOTS.reduce((s, sh) => s + sh.dur, 0); // 288
const TITLE_FRAMES = 57;  // 1.9s logo card
export const TOTAL_FRAMES = TOTAL_CLIPS_FRAMES + TITLE_FRAMES; // 345

// Video clip cropped to 9:16
function Clip({ file, startFrom, caption, isFirst }) {
  const frame = useCurrentFrame();
  const fadeDur = 9; // fade in frames

  const opacity = interpolate(frame, [0, fadeDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  const captionOpacity = interpolate(
    frame,
    [fadeDur, fadeDur + 6, 38, 44],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ background: '#000', opacity }}>
      {/* Video — scale to height, center crop to 9:16 */}
      <div style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <OffthreadVideo
          src={staticFile(file)}
          startFrom={startFrom}
          style={{
            height: '100%',
            width: 'auto',
            minWidth: '100%',
            objectFit: 'cover',
          }}
          muted
        />
      </div>

      {/* Subtle dark gradient bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 320,
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
      }} />

      {/* LAKMODA badge top-right */}
      <div style={{
        position: 'absolute', top: 60, right: 50,
        background: 'rgba(47,65,80,0.72)',
        border: `1px solid ${POWDER}`,
        borderRadius: 40,
        padding: '10px 22px',
        fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
        fontSize: 28,
        letterSpacing: '0.14em',
        color: POWDER,
        backdropFilter: 'blur(6px)',
      }}>
        LAKMODA
      </div>

      {/* Caption bottom */}
      <div style={{
        position: 'absolute', bottom: 90, left: 50, right: 50,
        opacity: captionOpacity,
        fontFamily: '"Raleway", "Georgia", serif',
        fontWeight: 300,
        fontSize: 38,
        color: WHITE,
        letterSpacing: '0.05em',
        textAlign: 'center',
        textShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}>
        {caption}
      </div>
    </AbsoluteFill>
  );
}

// Final logo card
function TitleCard() {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  const logoY = interpolate(frame, [0, 18], [30, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.2)),
  });

  const urlY = interpolate(frame, [8, 26], [20, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });

  const urlOpacity = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{
      background: NAVY,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: fadeIn,
    }}>
      {/* Texture dots */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle, ${POWDER}22 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
      }} />

      {/* Decorative line top */}
      <div style={{
        position: 'absolute', top: 200, left: 80, right: 80,
        height: 1, background: `${POWDER}44`,
      }} />

      {/* Main logo */}
      <div style={{
        transform: `translateY(${logoY}px)`,
        fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
        fontSize: 130,
        letterSpacing: '0.18em',
        color: POWDER,
        lineHeight: 1,
        textAlign: 'center',
        textShadow: `0 4px 40px ${POWDER}55`,
      }}>
        LAKMODA
      </div>

      {/* Tagline */}
      <div style={{
        marginTop: 18,
        fontFamily: '"Raleway", "Georgia", serif',
        fontWeight: 300,
        fontSize: 34,
        color: `${WHITE}bb`,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        маникюр · педикюр
      </div>

      {/* URL */}
      <div style={{
        marginTop: 48,
        transform: `translateY(${urlY}px)`,
        opacity: urlOpacity,
        fontFamily: '"Raleway", "Georgia", serif',
        fontWeight: 400,
        fontSize: 36,
        color: POWDER,
        letterSpacing: '0.08em',
        border: `1px solid ${POWDER}88`,
        borderRadius: 50,
        padding: '14px 44px',
        textAlign: 'center',
      }}>
        lakmoda.ru
      </div>

      {/* Decorative line bottom */}
      <div style={{
        position: 'absolute', bottom: 200, left: 80, right: 80,
        height: 1, background: `${POWDER}44`,
      }} />
    </AbsoluteFill>
  );
}

// Main composition
export function LakmodaReel() {
  let offset = 0;
  const sequences = SHOTS.map((shot, i) => {
    const el = (
      <Sequence key={i} from={offset} durationInFrames={shot.dur}>
        <Clip
          file={shot.file}
          startFrom={shot.from}
          caption={CAPTIONS[i]}
          isFirst={i === 0}
        />
      </Sequence>
    );
    offset += shot.dur;
    return el;
  });

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {sequences}

      {/* Title card */}
      <Sequence from={TOTAL_CLIPS_FRAMES} durationInFrames={TITLE_FRAMES}>
        <TitleCard />
      </Sequence>

      {/* Music */}
      <Audio src={staticFile('music.wav')} />
    </AbsoluteFill>
  );
}
