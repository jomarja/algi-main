import type { CSSProperties, ReactNode } from 'react';
import { MascotAvatar, cx, palette } from '../../design/index.ts';
import { svgPathData, totalLength } from './journeyPath.ts';
import type { JourneyPath, Point } from './journeyPath.ts';

interface RoadProps {
  path: JourneyPath;
  width: number;
  height: number;
  roadWidth: number;
  progressWidth: number;
  /** 0…1: how much of the road is drawn in mint. */
  progress: number;
  /** The dashed centre line of the full map. */
  hasCenterLine?: boolean;
}

/**
 * The road as SVG: a white band, an optional dashed centre line, and the travelled part in mint. The mint stroke is
 * trimmed with a dash the length of the road, so it grows smoothly when progress changes.
 */
export function Road({ path, width, height, roadWidth, progressWidth, progress, hasCenterLine = false }: RoadProps) {
  const d = svgPathData(path);
  const length = totalLength(path);
  const travelled = Math.min(Math.max(progress, 0), 1);

  return (
    <svg aria-hidden width={width} height={height} className="absolute left-0 top-0 overflow-visible">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} stroke={palette.surface} strokeWidth={roadWidth} />
        {hasCenterLine && <path d={d} stroke={palette.line} strokeWidth={2} strokeDasharray="6 9" />}
        <path
          d={d}
          stroke={palette.mint}
          strokeWidth={progressWidth}
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - travelled)}
          opacity={travelled > 0 ? 1 : 0}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </g>
    </svg>
  );
}

/** Centres its content on a point of the map. */
export function Pinned({ point, className, children }: { point: Point; className?: string; children: ReactNode }) {
  return (
    <div className={cx('absolute -translate-x-1/2 -translate-y-1/2', className)} style={{ left: point.x, top: point.y }}>
      {children}
    </div>
  );
}

/** Follows today's position along the road, gliding to the new spot when progress changes. */
export function Traveller({ point, children }: { point: Point; children: ReactNode }) {
  return (
    <div
      className="absolute left-0 top-0 transition-transform duration-700 ease-out"
      style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
    >
      {children}
    </div>
  );
}

interface RingedAvatarProps {
  size: number;
  ringWidth: number;
  shadow: string;
  style?: CSSProperties;
}

/** Luka's avatar with a white ring drawn inside its edge (iOS `Circle().strokeBorder(.white)`) and a soft shadow. */
export function RingedAvatar({ size, ringWidth, shadow, style }: RingedAvatarProps) {
  return (
    <span className="relative block rounded-full" style={{ width: size, height: size, boxShadow: shadow, ...style }}>
      <MascotAvatar size={size} decorative />
      <span aria-hidden className="absolute inset-0 rounded-full border-white" style={{ borderWidth: ringWidth }} />
    </span>
  );
}
