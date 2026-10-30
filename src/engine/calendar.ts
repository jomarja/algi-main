/**
 * The app's calendar, mirroring iOS `Calendar.algi`: Gregorian, Tbilisi time, Monday-first weeks.
 * Georgia has stayed on UTC+4 without daylight saving since 2005, so a fixed offset gives exact
 * wall-clock arithmetic without a time-zone library.
 */
export const ALGI_TIME_ZONE = 'Asia/Tbilisi';

const UTC_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Guards loops that walk month by month over dates from outside the app. */
const MAX_MONTH_STEPS = 1200;

/** Average month length used by every projection. */
export const AVERAGE_DAYS_PER_MONTH = 30.44;
export const WEEKS_PER_MONTH = AVERAGE_DAYS_PER_MONTH / 7;

export interface DateInterval {
  readonly start: Date;
  readonly end: Date;
}

/** Half-open: includes `start`, excludes `end`, so back-to-back periods never count a moment twice. */
export function intervalContains(interval: DateInterval, date: Date): boolean {
  const time = date.getTime();
  return time >= interval.start.getTime() && time < interval.end.getTime();
}

export interface DateParts {
  readonly year: number;
  /** 1 = January. */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 1 = Monday … 7 = Sunday. */
  readonly weekday: number;
}

/** Wall-clock fields of `date` in Tbilisi. */
export function dateParts(date: Date): DateParts {
  const shifted = new Date(date.getTime() + UTC_OFFSET_MS);
  const utcWeekday = shifted.getUTCDay();
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: utcWeekday === 0 ? 7 : utcWeekday,
  };
}

/** A moment given in Tbilisi wall-clock time. The default noon matches the iOS sample dates. */
export function tbilisiDate(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - UTC_OFFSET_MS);
}

export function startOfDay(date: Date): Date {
  const { year, month, day } = dateParts(date);
  return tbilisiDate(year, month, day, 0, 0);
}

export function startOfMonth(date: Date): Date {
  const { year, month } = dateParts(date);
  return tbilisiDate(year, month, 1, 0, 0);
}

/** Exact because the zone has no daylight saving: every day is 24 hours long. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Like Foundation: keeps the time of day and clamps the day to the target month (31 Jan + 1 month = 28 Feb). */
export function addMonths(date: Date, months: number): Date {
  const timeOfDay = date.getTime() - startOfDay(date).getTime();
  const { year, month, day } = dateParts(date);
  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = (((monthIndex % 12) + 12) % 12) + 1;
  const targetDay = Math.min(day, monthLength(targetYear, targetMonth));
  return new Date(tbilisiDate(targetYear, targetMonth, targetDay, 0, 0).getTime() + timeOfDay);
}

export function monthInterval(date: Date): DateInterval {
  const start = startOfMonth(date);
  return { start, end: addMonths(start, 1) };
}

export function weekInterval(date: Date): DateInterval {
  const start = addDays(startOfDay(date), 1 - dateParts(date).weekday);
  return { start, end: addDays(start, 7) };
}

export function dayInterval(date: Date): DateInterval {
  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

/** Whole calendar days from `from`'s day to `to`'s day; negative when `to` is earlier. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

export function daysInMonth(date: Date): number {
  const { year, month } = dateParts(date);
  return monthLength(year, month);
}

export function isWeekend(date: Date): boolean {
  return dateParts(date).weekday >= 6;
}

/** "2026-10": identifies a calendar month, e.g. for monthly allowances. */
export function monthKey(date: Date): string {
  const { year, month } = dateParts(date);
  return `${year}-${pad(month)}`;
}

/** "2026-10-29" in Tbilisi. */
export function isoDay(date: Date): string {
  const { year, month, day } = dateParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Parses "YYYY-MM-DD" as the start of that day in Tbilisi. */
export function parseIsoDay(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > monthLength(year, month)) return null;
  return tbilisiDate(year, month, day, 0, 0);
}

/** The first of `after + n months` (n ≥ 1) that falls on or after `notBefore`'s day. */
export function nextMonthlyDate(after: Date, notBefore: Date): Date {
  const earliest = startOfDay(notBefore).getTime();
  for (let months = 1; months < MAX_MONTH_STEPS; months += 1) {
    const candidate = addMonths(after, months);
    if (candidate.getTime() >= earliest) return candidate;
  }
  return addMonths(after, MAX_MONTH_STEPS);
}

/** Calendar months from `first` up to, but excluding, the month of `before`. */
export function monthsBetween(first: Date, before: Date): Date[] {
  const months: Date[] = [];
  const end = startOfMonth(before).getTime();
  for (let month = startOfMonth(first); month.getTime() < end && months.length < MAX_MONTH_STEPS; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

function monthLength(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
