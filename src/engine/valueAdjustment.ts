import { round } from './rounding.ts';

export interface ValueRange {
  readonly lower: number;
  readonly upper: number;
}

/** Maths behind the app's steppers and sliders. */
export const ValueAdjustment = {
  /** Snaps to the nearest step counted from the lower bound, then keeps the value inside the range. */
  snapped(raw: number, range: ValueRange, step: number): number {
    if (!Number.isFinite(raw)) return range.lower;
    const value = step > 0 ? range.lower + round((raw - range.lower) / step) * step : raw;
    return Math.min(Math.max(value, range.lower), range.upper);
  },

  /** Where a value sits on its range, 0...1. */
  fraction(value: number, range: ValueRange): number {
    const span = range.upper - range.lower;
    if (span <= 0) return 0;
    return Math.min(Math.max((value - range.lower) / span, 0), 1);
  },
} as const;
