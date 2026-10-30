import { describe, expect, it } from 'vitest';
import { tbilisiDate } from './calendar.ts';
import { sampleConverter as converter } from './currencyConverter.ts';
import { eur, gel, usd } from './money.ts';

describe('CurrencyConverter', () => {
  it('converts foreign currency to lari', () => {
    expect(converter.convert(usd(9.99), 'GEL')).toEqual(gel(26.97));
    expect(converter.convert(eur(5.99), 'GEL')).toEqual(gel(17.49));
  });

  it('converts lari to foreign currency', () => {
    expect(converter.convert(gel(27), 'USD')).toEqual(usd(10));
  });

  it('converts between two foreign currencies through lari', () => {
    expect(converter.convert(eur(2.7), 'USD')).toEqual(usd(2.92));
  });

  it('leaves the same currency untouched', () => {
    expect(converter.convert(gel(12.34), 'GEL')).toEqual(gel(12.34));
  });

  it('keeps the sign of negative amounts', () => {
    expect(converter.convert(usd(-9.99), 'GEL')).toEqual(gel(-26.97));
  });

  it('describes one unit in the target currency', () => {
    expect(converter.unitValue('USD', 'GEL')).toEqual(gel(2.7));
  });

  it('marks the sample rates illustrative and dates them like the iOS sample month', () => {
    expect(converter.isIllustrative).toBe(true);
    expect(converter.asOf).toEqual(tbilisiDate(2026, 10, 29, 9, 0));
    expect(converter.asOf.toISOString()).toBe('2026-10-29T05:00:00.000Z');
  });
});
