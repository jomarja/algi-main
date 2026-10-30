import type { CurrencyCode } from '../../shared/bank.ts';
import type { CoachAppContext } from '../../shared/coach.ts';

/** Formatting and text hygiene for the coach's data block. */

export type AppLanguage = CoachAppContext['language'];

export const MINUS_SIGN = '−';

const currencySigns: Record<CurrencyCode, string> = { GEL: '₾', USD: '$', EUR: '€' };

/**
 * Money as the app shows it: the lari sign follows the amount in both languages; Georgian groups
 * thousands with a space and uses a decimal comma ("1 240,50 ₾"), English uses "1,240.50 ₾" and "$1,240.50".
 * Luka copies figures from the data block, so formatting them per language keeps replies consistent.
 */
export function formatMoney(amount: number, currency: CurrencyCode, language: AppLanguage): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const digits = `${groupThousands(Math.floor(cents / 100), language)}${decimalSeparator(language)}${String(cents % 100).padStart(2, '0')}`;
  const sign = currencySigns[currency];
  const body = currency === 'GEL' || language === 'ka' ? `${digits} ${sign}` : `${sign}${digits}`;
  return amount < 0 && cents > 0 ? MINUS_SIGN + body : body;
}

/** Rates such as "16.5%" / "16,5%", to one decimal place at most. */
export function formatPercent(value: number, language: AppLanguage): string {
  const text = String(Math.round(value * 10) / 10);
  return `${language === 'ka' ? text.replace('.', ',') : text}%`;
}

function groupThousands(value: number, language: AppLanguage): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, language === 'ka' ? ' ' : ',');
}

function decimalSeparator(language: AppLanguage): string {
  return language === 'ka' ? ',' : '.';
}

// MARK: Dates (YYYY-MM-DD strings, compared as calendar days)

export interface CalendarDay {
  /** YYYY-MM-DD. */
  iso: string;
  /** English weekday name, e.g. "Friday". */
  weekday: string;
}

const tbilisiCalendar = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tbilisi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'long',
});

/** The calendar day in Georgia, where "today" and "this month" mean the same as on the user's phone. */
export function tbilisiToday(now: Date): CalendarDay {
  const parts = tbilisiCalendar.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return { iso: `${part('year')}-${part('month')}-${part('day')}`, weekday: part('weekday') };
}

/** "2026-10-30" → "2026-10". */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Whole calendar months from one day to another, never negative: 2026-10-30 → 2027-03-01 is 4. */
export function wholeMonthsBetween(fromIso: string, toIso: string): number {
  const [fromYear, fromMonth, fromDay] = fromIso.split('-').map(Number);
  const [toYear, toMonth, toDay] = toIso.split('-').map(Number);
  const months = (toYear - fromYear) * 12 + (toMonth - fromMonth) - (toDay < fromDay ? 1 : 0);
  return Math.max(months, 0);
}

// MARK: Text

// Control characters, invisible formatting and bidi overrides: they can hide or reorder text in a prompt.
const hiddenCharacters = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g;

/**
 * Makes text written by others (merchants, transfer notes, names) safe to quote in the data block:
 * one line, no angle brackets that could fake the block's tags, and a bounded length.
 */
export function sanitizeForPrompt(value: string, maxLength: number): string {
  const singleLine = value
    .replace(hiddenCharacters, ' ')
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/\s+/g, ' ')
    .trim();
  return clip(singleLine, maxLength);
}

/** Shortens text to `maxLength` characters, marking the cut with an ellipsis. Never splits an emoji. */
export function clip(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  return `${characters.slice(0, maxLength - 1).join('').trimEnd()}…`;
}
