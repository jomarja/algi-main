import { describe, expect, it } from 'vitest';
import { gel } from './money.ts';
import { alternativesSaving, revisedDeliveryBudget } from './spendingIntervention.ts';
import { ValueAdjustment } from './valueAdjustment.ts';

describe('ValueAdjustment', () => {
  it('snaps to the nearest step from the lower bound', () => {
    expect(ValueAdjustment.snapped(23, { lower: 20, upper: 100 }, 5)).toBe(25);
    expect(ValueAdjustment.snapped(22, { lower: 20, upper: 100 }, 5)).toBe(20);
    expect(ValueAdjustment.snapped(26, { lower: 1, upper: 360 }, 1)).toBe(26);
  });

  it('keeps values inside the range', () => {
    expect(ValueAdjustment.snapped(500, { lower: 0, upper: 250 }, 5)).toBe(250);
    expect(ValueAdjustment.snapped(-10, { lower: 0, upper: 250 }, 5)).toBe(0);
  });

  it('clamps a grid point past an off-grid upper bound', () => {
    expect(ValueAdjustment.snapped(103, { lower: 20, upper: 103 }, 5)).toBe(103);
  });

  it('falls back to the lower bound for non-finite input', () => {
    expect(ValueAdjustment.snapped(Number.NaN, { lower: 60, upper: 300 }, 10)).toBe(60);
    expect(ValueAdjustment.snapped(Number.POSITIVE_INFINITY, { lower: 60, upper: 300 }, 10)).toBe(60);
  });

  it('only clamps when there is no step', () => {
    expect(ValueAdjustment.snapped(37.5, { lower: 0, upper: 100 }, 0)).toBe(37.5);
    expect(ValueAdjustment.snapped(150, { lower: 0, upper: 100 }, 0)).toBe(100);
  });

  it('finds where a value sits on the range', () => {
    expect(ValueAdjustment.fraction(60, { lower: 20, upper: 100 })).toBe(0.5);
    expect(ValueAdjustment.fraction(20, { lower: 20, upper: 100 })).toBe(0);
    expect(ValueAdjustment.fraction(100, { lower: 20, upper: 100 })).toBe(1);
  });

  it('keeps the fraction between zero and one', () => {
    expect(ValueAdjustment.fraction(0, { lower: 20, upper: 100 })).toBe(0);
    expect(ValueAdjustment.fraction(200, { lower: 20, upper: 100 })).toBe(1);
  });

  it('treats a zero-width range as the start', () => {
    expect(ValueAdjustment.fraction(5, { lower: 5, upper: 5 })).toBe(0);
  });
});

describe('Delivery budget alternatives', () => {
  it('adds up the chosen swaps', () => {
    expect(alternativesSaving([1, 3])).toEqual(gel(57));
    expect(alternativesSaving([])).toEqual(gel(0));
  });

  it('lowers the budget in 5 ₾ steps but never below the minimum', () => {
    expect(revisedDeliveryBudget(gel(200), [1])).toEqual(gel(165));
    expect(revisedDeliveryBudget(gel(200), [1, 2, 3])).toEqual(gel(70));
    expect(revisedDeliveryBudget(gel(100), [2])).toEqual(gel(60));
  });
});
