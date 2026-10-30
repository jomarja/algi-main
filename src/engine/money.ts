import type { CurrencyCode } from '../../shared/bank.ts';
import { round, type RoundingRule } from './rounding.ts';

export type { CurrencyCode };

/** An amount of money stored in minor units (tetri, cents) so arithmetic never drifts. */
export interface Money {
  readonly minorUnits: number;
  readonly currency: CurrencyCode;
}

export const CURRENCIES: readonly CurrencyCode[] = ['GEL', 'USD', 'EUR'];

export const CURRENCY_SYMBOLS: Readonly<Record<CurrencyCode, string>> = { GEL: '₾', USD: '$', EUR: '€' };

/** Largest amount accepted from user input; keeps minor-unit maths far from floating-point limits. */
export const MAXIMUM_PARSABLE_AMOUNT = 1_000_000_000;

export function fromMinorUnits(minorUnits: number, currency: CurrencyCode): Money {
  // −0 would make equal amounts compare unequal in deep-equality checks.
  return { minorUnits: minorUnits === 0 ? 0 : minorUnits, currency };
}

export function money(major: number, currency: CurrencyCode): Money {
  return fromMinorUnits(round(major * 100), currency);
}

export function gel(major: number): Money {
  return money(major, 'GEL');
}

export function usd(major: number): Money {
  return money(major, 'USD');
}

export function eur(major: number): Money {
  return money(major, 'EUR');
}

export function zero(currency: CurrencyCode): Money {
  return fromMinorUnits(0, currency);
}

export function isZero(value: Money): boolean {
  return value.minorUnits === 0;
}

export function majorUnits(value: Money): number {
  return value.minorUnits / 100;
}

export function add(lhs: Money, rhs: Money): Money {
  assertSameCurrency(lhs, rhs);
  return fromMinorUnits(lhs.minorUnits + rhs.minorUnits, lhs.currency);
}

export function subtract(lhs: Money, rhs: Money): Money {
  return add(lhs, negate(rhs));
}

export function negate(value: Money): Money {
  return fromMinorUnits(-value.minorUnits, value.currency);
}

export function multiply(value: Money, factor: number): Money {
  return fromMinorUnits(round(value.minorUnits * factor), value.currency);
}

/**
 * Divides by multiplying with the reciprocal, exactly as the iOS app does, so halves round the same way.
 * Dividing by zero leaves the amount unchanged.
 */
export function divide(value: Money, divisor: number): Money {
  return divisor === 0 ? value : multiply(value, 1 / divisor);
}

/** Negative when `lhs` is smaller, zero when equal, positive when larger. */
export function compare(lhs: Money, rhs: Money): number {
  assertSameCurrency(lhs, rhs);
  return lhs.minorUnits - rhs.minorUnits;
}

export function moneyEquals(lhs: Money, rhs: Money): boolean {
  return lhs.currency === rhs.currency && lhs.minorUnits === rhs.minorUnits;
}

export function minMoney(lhs: Money, rhs: Money): Money {
  return compare(lhs, rhs) <= 0 ? lhs : rhs;
}

export function maxMoney(lhs: Money, rhs: Money): Money {
  return compare(lhs, rhs) >= 0 ? lhs : rhs;
}

/** Share of `total` this amount represents; 0 when the total is zero. */
export function fraction(value: Money, total: Money): number {
  return total.minorUnits === 0 ? 0 : value.minorUnits / total.minorUnits;
}

export function sum(values: readonly Money[], currency: CurrencyCode): Money {
  return values.reduce(add, zero(currency));
}

/** Rounds to a whole multiple of `step` major units, e.g. 5 ₾ steps for friendlier plan amounts. */
export function roundedToMultiple(
  value: Money,
  step: number,
  rule: RoundingRule = 'toNearestOrAwayFromZero',
): Money {
  const stepMinorUnits = step * 100;
  if (stepMinorUnits <= 0) return value;
  const multiples = round(value.minorUnits / stepMinorUnits, rule);
  return fromMinorUnits(multiples * stepMinorUnits, value.currency);
}

const PLAIN_AMOUNT = /^[0-9.]+$/;

/**
 * Parses typed amounts such as "45.90" or "1 240,50". Returns null for anything that isn't a plain,
 * non-negative number within `MAXIMUM_PARSABLE_AMOUNT`, so pasted text like "1e400" is rejected.
 */
export function parseMoney(text: string, currency: CurrencyCode): Money | null {
  const normalized = text.replace(/\s/g, '').replaceAll(',', '.');
  if (!PLAIN_AMOUNT.test(normalized)) return null;
  const value = Number(normalized);
  if (Number.isNaN(value) || value > MAXIMUM_PARSABLE_AMOUNT) return null;
  return money(value, currency);
}

/** Keeps a number typed into an amount field within what minor-unit maths can safely hold. */
export function safeAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAXIMUM_PARSABLE_AMOUNT);
}

function assertSameCurrency(lhs: Money, rhs: Money): void {
  if (lhs.currency !== rhs.currency) {
    throw new Error(`Convert money before combining ${lhs.currency} with ${rhs.currency}.`);
  }
}
