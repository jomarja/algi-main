import type { AppLanguage } from './localization.ts';
import { CURRENCY_SYMBOLS, type CurrencyCode, type Money } from './money.ts';

export type MoneyPrecision = 'cents' | 'whole';

/**
 * - automatic: only negative amounts get a sign.
 * - always: positive amounts get "+", used for income.
 * - never: the magnitude only, for copy that already says "less" or "more".
 */
export type SignDisplay = 'automatic' | 'always' | 'never';

export interface MoneyFormatOptions {
  readonly precision?: MoneyPrecision;
  readonly sign?: SignDisplay;
}

export const NON_BREAKING_SPACE = ' ';
export const MINUS_SIGN = '−';

/**
 * Formats money following Georgian conventions: the lari sign follows the amount in every language,
 * and Georgian copy uses a space for grouping and a comma for decimals ("1 240,50 ₾").
 * Formatting is done by hand so output is identical in every browser and matches the iOS app.
 */
export function formatMoney(value: Money, language: AppLanguage, options: MoneyFormatOptions = {}): string {
  const { precision = 'cents', sign = 'automatic' } = options;
  const { digits, roundsToZero } = formattedDigits(Math.abs(value.minorUnits), precision, language);
  return signPrefix(value, sign, roundsToZero) + placingSymbol(digits, value.currency, language);
}

function formattedDigits(
  magnitude: number,
  precision: MoneyPrecision,
  language: AppLanguage,
): { digits: string; roundsToZero: boolean } {
  if (precision === 'whole') {
    const wholeUnits = Math.floor((magnitude + 50) / 100);
    return { digits: grouped(wholeUnits, language), roundsToZero: wholeUnits === 0 };
  }
  const digits = grouped(Math.floor(magnitude / 100), language) + decimalSeparator(language) + twoDigits(magnitude % 100);
  return { digits, roundsToZero: magnitude === 0 };
}

function signPrefix(value: Money, sign: SignDisplay, roundsToZero: boolean): string {
  if (roundsToZero || sign === 'never') return '';
  if (value.minorUnits < 0) return MINUS_SIGN;
  return sign === 'always' ? '+' : '';
}

function placingSymbol(digits: string, currency: CurrencyCode, language: AppLanguage): string {
  if (currency === 'GEL' || language === 'ka') return digits + NON_BREAKING_SPACE + CURRENCY_SYMBOLS[currency];
  return CURRENCY_SYMBOLS[currency] + digits;
}

function grouped(value: number, language: AppLanguage): string {
  const separator = language === 'ka' ? NON_BREAKING_SPACE : ',';
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function decimalSeparator(language: AppLanguage): string {
  return language === 'ka' ? ',' : '.';
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
