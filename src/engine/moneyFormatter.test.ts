import { describe, expect, it } from 'vitest';
import { eur, gel, usd, zero } from './money.ts';
import { formatMoney, MINUS_SIGN as minus, NON_BREAKING_SPACE as space } from './moneyFormatter.ts';

describe('MoneyFormatter', () => {
  it('formats lari after the amount in English', () => {
    expect(formatMoney(gel(1240.5), 'en')).toBe(`1,240.50${space}₾`);
  });

  it('uses Georgian separators in Georgian', () => {
    expect(formatMoney(gel(1240.5), 'ka')).toBe(`1${space}240,50${space}₾`);
  });

  it('groups large amounts', () => {
    expect(formatMoney(gel(1_234_567.89), 'en')).toBe(`1,234,567.89${space}₾`);
  });

  it('pads small cents', () => {
    expect(formatMoney(gel(0.05), 'en')).toBe(`0.05${space}₾`);
  });

  it('rounds half up for whole precision', () => {
    expect(formatMoney(gel(431.5), 'en', { precision: 'whole' })).toBe(`432${space}₾`);
    expect(formatMoney(gel(431.49), 'en', { precision: 'whole' })).toBe(`431${space}₾`);
  });

  it('places dollar and euro before the amount in English', () => {
    expect(formatMoney(usd(9.99), 'en')).toBe('$9.99');
    expect(formatMoney(eur(-5.99), 'en')).toBe(`${minus}€5.99`);
  });

  it('places dollar after the amount in Georgian', () => {
    expect(formatMoney(usd(9.99), 'ka')).toBe(`9,99${space}$`);
  });

  it('shows plus only when asked', () => {
    expect(formatMoney(gel(3200), 'en', { sign: 'always' })).toBe(`+3,200.00${space}₾`);
    expect(formatMoney(gel(3200), 'en')).toBe(`3,200.00${space}₾`);
  });

  it('uses a typographic minus for negatives', () => {
    expect(formatMoney(gel(-18.5), 'en', { sign: 'always' })).toBe(`${minus}18.50${space}₾`);
  });

  it('omits the sign for zero and amounts that round to zero', () => {
    expect(formatMoney(zero('GEL'), 'en', { sign: 'always' })).toBe(`0.00${space}₾`);
    expect(formatMoney(gel(-0.4), 'en', { precision: 'whole' })).toBe(`0${space}₾`);
  });

  it('shows only the magnitude when the sign is never shown', () => {
    expect(formatMoney(gel(-18.5), 'en', { sign: 'never' })).toBe(`18.50${space}₾`);
    expect(formatMoney(gel(25), 'en', { sign: 'never' })).toBe(`25.00${space}₾`);
  });
});
