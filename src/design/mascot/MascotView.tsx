import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { cx } from '../cx.ts';
import { palette } from '../tokens.ts';
import type { PaletteToken } from '../tokens.ts';
import { destinationImage, mascotImage, mascotPoseInfo, propImages } from './assets.ts';
import type { IllustrationProp, JourneyDestination, MascotPose } from './assets.ts';

const artworkHeight = 640;

interface MascotViewProps {
  pose: MascotPose;
  /** Hide from assistive technology when the surrounding text already says it all. */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Luka in a pose, scaled to fit its box without distortion. */
export function MascotView({ pose, decorative = false, className, style }: MascotViewProps) {
  const display = useDisplay();
  const info = mascotPoseInfo[pose];
  return (
    <img
      src={mascotImage(pose)}
      alt={decorative ? '' : display.text(info.description)}
      width={Math.round(artworkHeight * info.aspectRatio)}
      height={artworkHeight}
      draggable={false}
      decoding="async"
      className={cx('object-contain', className)}
      style={style}
    />
  );
}

interface MascotAvatarProps {
  size?: number;
  background?: PaletteToken;
  decorative?: boolean;
}

/** Luka's head and shoulders in a circle, for chat and greetings. */
export function MascotAvatar({ size = 44, background = 'mintPale', decorative = false }: MascotAvatarProps) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: palette[background] }}
    >
      <MascotView pose="avatar" decorative={decorative} className="h-full w-full" />
    </span>
  );
}

interface LukaAvatarTileProps {
  /** Sinks Luka out of sight: 0 in place, 1 gone (the money toss shows him ducking out and back). */
  headDrop?: number;
  className?: string;
  style?: CSSProperties;
}

/** Luka's head and shoulders on a rounded mint tile, as in the Home greeting. Size it with `className`. */
export const LukaAvatarTile = forwardRef<HTMLDivElement, LukaAvatarTileProps>(function LukaAvatarTile(
  { headDrop = 0, className, style },
  ref,
) {
  return (
    <div ref={ref} className={cx('relative overflow-hidden rounded-lg bg-mintPale', className)} style={style}>
      <MascotView
        pose="avatar"
        className="absolute inset-0 h-full w-full"
        style={{ transform: `translateY(${headDrop * 100}%)` }}
      />
    </div>
  );
});

interface IllustrationStageProps {
  pose: MascotPose;
  background?: PaletteToken;
  height?: number;
  className?: string;
}

/** A large illustration on a soft tinted backdrop with decorative rings, as in onboarding and milestones. */
export function IllustrationStage({ pose, background = 'mintPale', height = 300, className }: IllustrationStageProps) {
  const ring = height * 0.62;
  const dot = height * 0.22;
  return (
    <div
      className={cx('relative w-full overflow-hidden', className)}
      style={{ height, backgroundColor: palette[background] }}
    >
      <span
        aria-hidden
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: ring,
          height: ring,
          left: `calc(50% - ${height * 0.32}px)`,
          top: height * 0.39,
          border: '34px solid rgba(255, 255, 255, 0.55)',
        }}
      />
      <span
        aria-hidden
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35"
        style={{ width: dot, height: dot, left: `calc(50% + ${height * 0.48}px)`, top: height * 0.27 }}
      />
      <MascotView
        pose={pose}
        className="absolute bottom-0 left-1/2 w-auto -translate-x-1/2"
        style={{ height: height * 0.92 }}
      />
    </div>
  );
}

/** Supporting artwork (coin, banknote, Luka's peeking hands). Always decorative. */
export function PropView({ prop, className, style }: { prop: IllustrationProp; className?: string; style?: CSSProperties }) {
  const image = propImages[prop];
  return (
    <img
      src={image.src}
      alt=""
      aria-hidden
      width={Math.round(256 * image.aspectRatio)}
      height={256}
      draggable={false}
      decoding="async"
      className={cx('object-contain', className)}
      style={style}
    />
  );
}

/** Destination artwork at the end of a journey map. Always decorative. */
export function DestinationView({ destination, className }: { destination: JourneyDestination; className?: string }) {
  return (
    <img
      src={destinationImage(destination)}
      alt=""
      aria-hidden
      width={200}
      height={160}
      draggable={false}
      decoding="async"
      className={cx('object-contain', className)}
    />
  );
}
