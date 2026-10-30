import { describe, expect, it } from 'vitest';
import {
  add,
  compare,
  divide,
  eur,
  fraction,
  gel,
  MAXIMUM_PARSABLE_AMOUNT,
  maxMoney,
  minMoney,
  money,
  multiply,
  negate,
  parseMoney,
  roundedToMultiple,
  safeAmount,
  subtract,
  sum,
  usd,
  zero,
} from './money.ts';

describe('Money', () => {
  it('stores decimal amounts as exact minor units', () => {
    expect(gel(34.8).minorUnits).toBe(3480);
    expect(usd(0.99).minorUnits).toBe(99);
    expect(eur(1234.56).minorUnits).toBe(123_456);
  });

  it('adds, subtracts and negates', () => {
    const total = add(gel(10.25), gel(4.75));
    expect(total).toEqual(gel(15));
    expect(subtract(total, gel(20))).toEqual(gel(-5));
    expect(negate(gel(3))).toEqual(gel(-3));
  });

  it('multiplies and divides with rounding', () => {
    expect(multiply(gel(450), 0.75)).toEqual(gel(337.5));
    expect(divide(gel(10), 3)).toEqual(gel(3.33));
    expect(divide(gel(10), 0)).toEqual(gel(10));
  });

  it('rounds halves away from zero like Swift', () => {
    expect(money(-0.025, 'GEL').minorUnits).toBe(-3);
    expect(multiply(gel(-0.05), 0.5).minorUnits).toBe(-3);
    expect(negate(zero('GEL'))).toEqual(zero('GEL'));
  });

  it('computes the fraction of a total', () => {
    expect(fraction(gel(50), gel(200))).toBe(0.25);
    expect(fraction(gel(50), zero('GEL'))).toBe(0);
  });

  it('parses typed amounts', () => {
    expect(parseMoney('45.90', 'GEL')).toEqual(gel(45.9));
    expect(parseMoney('1 240,50', 'GEL')).toEqual(gel(1240.5));
    expect(parseMoney('1 240,50', 'USD')).toEqual(usd(1240.5));
    expect(parseMoney('0', 'GEL')).toEqual(zero('GEL'));
  });

  it.each(['', 'abc', '-5', '1e400', 'inf', '1.2.3', '2000000000', '9'.repeat(400)])(
    'rejects invalid or unsafe amount %#',
    (text) => {
      expect(parseMoney(text, 'GEL')).toBeNull();
    },
  );

  it('keeps typed amounts within safe bounds', () => {
    expect(safeAmount(250.5)).toBe(250.5);
    expect(safeAmount(-10)).toBe(0);
    expect(safeAmount(1e20)).toBe(MAXIMUM_PARSABLE_AMOUNT);
    expect(safeAmount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(safeAmount(Number.NaN)).toBe(0);
  });

  it('rounds to friendly steps', () => {
    expect(roundedToMultiple(gel(34), 5)).toEqual(gel(35));
    expect(roundedToMultiple(gel(26), 5)).toEqual(gel(25));
    expect(roundedToMultiple(gel(548), 5, 'down')).toEqual(gel(545));
    expect(roundedToMultiple(gel(230.57), 5, 'up')).toEqual(gel(235));
    expect(roundedToMultiple(gel(12), 0)).toEqual(gel(12));
  });

  it('compares and sums', () => {
    expect(compare(gel(1), gel(2))).toBeLessThan(0);
    expect(minMoney(gel(1), gel(2))).toEqual(gel(1));
    expect(maxMoney(gel(1), gel(2))).toEqual(gel(2));
    expect(sum([gel(1), gel(2.5), gel(0.5)], 'GEL')).toEqual(gel(4));
    expect(sum([], 'USD')).toEqual(zero('USD'));
  });

  it('refuses to combine different currencies', () => {
    expect(() => add(gel(1), usd(1))).toThrow();
    expect(() => compare(gel(1), eur(1))).toThrow();
  });
});
