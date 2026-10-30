import { sampleConverter, type CurrencyConverter } from './currencyConverter.ts';
import { formatDate, relativeDay, type DateStyle } from './dateText.ts';
import { joinList, resolveText, type AppLanguage, type LocalizedText } from './localization.ts';
import type { CurrencyCode, Money } from './money.ts';
import { formatMoney, type MoneyFormatOptions } from './moneyFormatter.ts';

export type { DateStyle } from './dateText.ts';
export type { MoneyFormatOptions, MoneyPrecision, SignDisplay } from './moneyFormatter.ts';

/** Everything a screen needs to present copy, money, and dates in the user's language and display currency. */
export interface Display {
  readonly language: AppLanguage;
  readonly currency: CurrencyCode;
  readonly converter: CurrencyConverter;
  /** Picks the copy for the active language. */
  t(en: string, ka: string): string;
  text(value: LocalizedText): string;
  /** Formats money in the display currency, converting it when its original currency differs. */
  money(value: Money, options?: MoneyFormatOptions): string;
  /** Formats money in the currency it was originally recorded in. */
  original(value: Money, options?: MoneyFormatOptions): string;
  date(value: Date, style: DateStyle): string;
  relativeDay(value: Date, now: Date): string;
  /** Joins items the way the language does, e.g. "A, B and C" / "A, B და C". */
  list(items: readonly string[]): string;
}

export function createDisplay(
  language: AppLanguage = 'en',
  currency: CurrencyCode = 'GEL',
  converter: CurrencyConverter = sampleConverter,
): Display {
  return {
    language,
    currency,
    converter,
    t: (en, ka) => (language === 'en' ? en : ka),
    text: (value) => resolveText(value, language),
    money: (value, options) => formatMoney(converter.convert(value, currency), language, options),
    original: (value, options) => formatMoney(value, language, options),
    date: (value, style) => formatDate(value, style, language),
    relativeDay: (value, now) => relativeDay(value, now, language),
    list: (items) => joinList(items, language),
  };
}
