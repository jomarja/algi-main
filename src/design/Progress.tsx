import { cx } from './cx.ts';
import { palette } from './tokens.ts';
import type { PaletteToken } from './tokens.ts';
import { trendWavePath } from './trendWave.ts';

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}

interface ProgressBarProps {
  /** 0…1; values outside are clamped. */
  value: number;
  tint?: PaletteToken;
  track?: PaletteToken;
  height?: number;
  /** Accessible name, e.g. "Delivery budget". */
  label?: string;
}

/** A capsule track filled from the left. The fill slides (transform only) when the value changes. */
export function ProgressBar({ value, tint = 'mint', track = 'line', height = 8, label }: ProgressBarProps) {
  const clamped = clampUnit(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="relative w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: palette[track] }}
    >
      <span
        className="absolute inset-0 rounded-full transition-transform duration-500 ease-out"
        style={{ backgroundColor: palette[tint], transform: `translateX(${(clamped - 1) * 100}%)` }}
      />
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  tint?: PaletteToken;
  track?: PaletteToken;
  lineWidth?: number;
  size?: number;
  /** Text in the middle, e.g. "66%". */
  label?: string;
  /** Accessible name; defaults to `label`. */
  accessibleLabel?: string;
}

export function ProgressRing({
  value,
  tint = 'mint',
  track = 'line',
  lineWidth = 8,
  size = 60,
  label,
  accessibleLabel,
}: ProgressRingProps) {
  const clamped = clampUnit(value);
  const radius = (size - lineWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      role="progressbar"
      aria-label={accessibleLabel ?? label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={palette[track]} strokeWidth={lineWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette[tint]}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          opacity={clamped > 0 ? 1 : 0}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {label && <span className="type-caption absolute font-bold text-ink">{label}</span>}
    </div>
  );
}

const waveWidth = 300;

/** The decorative balance-card trend: a soft mint glow under a white line. Not plotted to scale. */
export function TrendWave({ values, height = 54, className }: { values: readonly number[]; height?: number; className?: string }) {
  const path = trendWavePath(values, waveWidth, height);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${waveWidth} ${height}`}
      preserveAspectRatio="none"
      overflow="visible"
      className={cx('block w-full', className)}
      style={{ height }}
    >
      <path d={path} fill="none" stroke={palette.mint} strokeOpacity={0.35} strokeWidth={12} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={path} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
