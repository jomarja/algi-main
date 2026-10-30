/** The Swift `FloatingPointRoundingRule` cases the app relies on. */
export type RoundingRule = 'toNearestOrAwayFromZero' | 'up' | 'down';

/**
 * Rounds the way Swift's `Double.rounded(_:)` does, so every figure matches the iOS app.
 * `Math.round` alone rounds halves toward +∞, which would turn −2.5 into −2 instead of −3.
 */
export function round(value: number, rule: RoundingRule = 'toNearestOrAwayFromZero'): number {
  const rounded = roundWithoutSignedZero(value, rule);
  return rounded === 0 ? 0 : rounded;
}

function roundWithoutSignedZero(value: number, rule: RoundingRule): number {
  switch (rule) {
    case 'up':
      return Math.ceil(value);
    case 'down':
      return Math.floor(value);
    case 'toNearestOrAwayFromZero':
      return Math.sign(value) * Math.round(Math.abs(value));
  }
}
