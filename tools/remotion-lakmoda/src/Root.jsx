import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { LakmodaReel, TOTAL_FRAMES } from './LakmodaReel';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="LakmodaReel"
        component={LakmodaReel}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);
