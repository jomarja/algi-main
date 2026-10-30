import type { ReactNode } from 'react';
import { ProgressRing } from '../../../design/index.ts';
import type { PaletteToken } from '../../../design/index.ts';

interface RingBadgeProps {
  /** 0…1. */
  value: number;
  tint: PaletteToken;
  size: number;
  lineWidth: number;
  /** Accessible name of the progress. */
  label: string;
  /** Drawn in the middle of the ring, e.g. a symbol and a percentage. */
  children: ReactNode;
}

/** A progress ring with custom content in its centre (iOS: a ZStack of ProgressRing and content). */
export function RingBadge({ value, tint, size, lineWidth, label, children }: RingBadgeProps) {
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <ProgressRing value={value} tint={tint} size={size} lineWidth={lineWidth} accessibleLabel={label} />
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children}
      </div>
    </div>
  );
}
