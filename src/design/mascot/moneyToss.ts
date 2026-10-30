import type { IllustrationProp } from './assets.ts';

/** Geometry and timing of Luka's money toss, ported from MoneyTossOverlay.swift. All times in seconds. */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the throwing hand sits in the toss artwork (mascot-toss.png); update it whenever that image changes. */
export const handAnchor: Point = { x: 0.74, y: 0.28 };
/** The part of the toss artwork that fills the tile: his head, chest and throwing hand. */
export const tileCrop: Rect = { x: 0.27, y: 0.04, width: 0.56, height: 0.56 };
/** He leans around his chest while throwing, as a fraction of the toss artwork. */
export const leanAnchor: Point = { x: 0.5, y: 0.62 };

export const tossPieces: readonly IllustrationProp[] = ['coin', 'banknote', 'coin', 'coin', 'banknote', 'coin'];
/** How high above the straight line each piece is lobbed, so the throw fans out instead of moving in lockstep. */
export const lobHeights: readonly number[] = [80, 110, 95, 125, 90, 105];

const sink = 0.15;
const pop = 0.4;
const duck = 0.3;
const comeBack = 0.4;
const launchDelay = 0.55;
const stagger = 0.08;
const flight = 0.65;
const landing = launchDelay + stagger * (tossPieces.length - 1) + flight;
const total = landing + 1.1;
const hold = total - sink - pop - duck - comeBack;

export const tossTiming = {
  /** Home waits this long after a refresh before throwing, so the pull-to-refresh space can close first. */
  startDelay: 0.4,
  /** His head sinks out of view. */
  sink,
  /** He rises into view in his throwing pose. */
  pop,
  /** How long he stays up between rising and sinking back. */
  hold,
  /** He sinks back out of view. */
  duck,
  /** His head comes back up. */
  comeBack,
  launchDelay,
  stagger,
  flight,
  /** From the start until the last piece lands: when the host should show the new balance. */
  landing,
  /** How long the overlay stays on screen. */
  total,
} as const;

/** Where the toss artwork is drawn, in the tile's own coordinates, so that `tileCrop` fills the tile. */
export function tossArtFrame(tile: { width: number; height: number }): Rect {
  const side = Math.max(tile.width / tileCrop.width, tile.height / tileCrop.height);
  return { x: -tileCrop.x * side, y: -tileCrop.y * side, width: side, height: side };
}

/** The throwing hand once Luka is fully up, in the same coordinates as `tile`. */
export function throwingHand(tile: Rect): Point {
  const art = tossArtFrame(tile);
  return {
    x: tile.x + art.x + handAnchor.x * art.width,
    y: tile.y + art.y + handAnchor.y * art.height,
  };
}

/** A point on the throw's arc: a quadratic curve peaking `lob` above the higher end, so money is lobbed, not slid. */
export function arcPoint(start: Point, end: Point, progress: number, lob = 90): Point {
  const control = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - lob };
  const remaining = 1 - progress;
  const a = remaining * remaining;
  const b = 2 * remaining * progress;
  const c = progress * progress;
  return {
    x: a * start.x + b * control.x + c * end.x,
    y: a * start.y + b * control.y + c * end.y,
  };
}

/** Spreads landings across the number so the pieces don't stack on one spot. */
export function landingPoint(target: Rect, index: number, count: number): Point {
  const spread = index / Math.max(count - 1, 1) - 0.5;
  return { x: target.x + target.width / 2 + target.width * 0.6 * spread, y: target.y + target.height / 2 };
}

/**
 * One piece's flight as keyframes sampled along the arc. Linear time along the arc gives real projectile motion.
 * It pops to full size leaving the hand, shrinks a little as it falls, and vanishes on landing.
 * Coins flip end over end; notes flutter.
 */
export function flightKeyframes(prop: IllustrationProp, start: Point, end: Point, lob: number, samples = 24): Keyframe[] {
  return Array.from({ length: samples + 1 }, (_, step) => {
    const progress = step / samples;
    const point = arcPoint(start, end, progress, lob);
    const launch = Math.min(progress / 0.15, 1);
    const scale = (0.6 + 0.4 * launch) * (1 - 0.25 * progress);
    const spin =
      prop === 'banknote'
        ? `rotate(${progress * 160}deg) perspective(240px) rotateX(${35 * Math.sin(progress * 4 * Math.PI)}deg)`
        : `rotate(0deg) perspective(240px) rotateY(${progress * 720}deg)`;
    return {
      offset: progress,
      opacity: progress > 0 && progress < 0.97 ? 1 : 0,
      transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${scale}) ${spin}`,
    };
  });
}
