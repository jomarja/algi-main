/** Pull-to-refresh maths for PeekingLuka (PeekingLuka.swift). */

/** Height of the strip above the page where Luka shows; roughly his hair down to his nose. */
export const peekVisibleHeight = 70;

/** How far Luka has risen, from 0 (hidden behind the page) to 1 (peeking). */
export function peekReveal(pullDistance: number, isRefreshing: boolean): number {
  if (isRefreshing) return 1;
  return Math.min(Math.max(pullDistance / peekVisibleHeight, 0), 1);
}

/** Resistance of the pull: follows the finger at first, then stiffens, approaching 140px. */
export function rubberBand(distance: number): number {
  return distance <= 0 ? 0 : 140 * (1 - Math.exp(-distance / 220));
}
