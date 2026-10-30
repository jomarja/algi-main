import { useEffect, useRef } from 'react';
import type { SyntheticEvent } from 'react';
import type { LocalizedText } from '../../engine/localization.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { cx } from '../cx.ts';
import { useReducedMotion } from '../media.ts';
import { mascotPoseInfo } from './assets.ts';

/** Looping clips of Luka; each has a still that shows before it plays and when reduced motion is on. */
export type LukaClip = 'welcome' | 'coinSwim';

interface ClipInfo {
  video: string;
  poster: string;
  /** The welcome wave runs a little slow so Luka's movements stay soft and unhurried. */
  playbackRate: number;
  description: LocalizedText;
}

const clips: Record<LukaClip, ClipInfo> = {
  welcome: {
    video: '/luka/animations/luka-welcome.mp4',
    poster: '/luka/animations/luka-welcome-poster.png',
    playbackRate: 0.8,
    description: mascotPoseInfo.welcome.description,
  },
  coinSwim: {
    video: '/luka/animations/luka-coin-swim.mp4',
    poster: '/luka/animations/luka-coin-swim-poster.png',
    playbackRate: 1,
    description: { en: 'Luka swimming through a sea of coins', ka: 'ლუკა მონეტების ზღვაში ცურავს' },
  },
};

/** Which part of the clip stays in view when the frame crops the rest (SwiftUI Alignment). */
export type ClipAlignment =
  | 'center'
  | 'top'
  | 'bottom'
  | 'leading'
  | 'trailing'
  | 'topLeading'
  | 'topTrailing'
  | 'bottomLeading'
  | 'bottomTrailing';

const objectPositions: Record<ClipAlignment, string> = {
  center: '50% 50%',
  top: '50% 0%',
  bottom: '50% 100%',
  leading: '0% 50%',
  trailing: '100% 50%',
  topLeading: '0% 0%',
  topTrailing: '100% 0%',
  bottomLeading: '0% 100%',
  bottomTrailing: '100% 100%',
};

interface LukaAnimationProps {
  clip: LukaClip;
  alignment?: ClipAlignment;
  /** Size the frame here; the clip fills it without stretching. */
  className?: string;
}

/** Plays a Luka clip on a silent loop, filling its frame. Pauses off screen; shows the still with reduced motion. */
export function LukaAnimation({ clip, alignment = 'center', className }: LukaAnimationProps) {
  const reduceMotion = useReducedMotion();
  const display = useDisplay();
  const video = useRef<HTMLVideoElement>(null);
  const info = clips[clip];
  const objectPosition = objectPositions[alignment];

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    // React doesn't reliably reflect `muted` to the DOM, and browsers only autoplay muted video.
    element.muted = true;
    const observer = new IntersectionObserver(([entry]) => {
      // Autoplay can still be refused (e.g. iOS Low Power Mode); the poster then stays, which is fine.
      if (entry.isIntersecting) element.play().catch(() => undefined);
      else element.pause();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [clip, reduceMotion]);

  const applyPlaybackRate = (event: SyntheticEvent<HTMLVideoElement>) => {
    event.currentTarget.defaultPlaybackRate = info.playbackRate;
    event.currentTarget.playbackRate = info.playbackRate;
  };

  return (
    <div role="img" aria-label={display.text(info.description)} className={cx('relative overflow-hidden', className)}>
      <img
        src={info.poster}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition }}
      />
      {!reduceMotion && (
        <video
          key={clip}
          ref={video}
          src={info.video}
          poster={info.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          aria-hidden
          onLoadedMetadata={applyPlaybackRate}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
        />
      )}
    </div>
  );
}
