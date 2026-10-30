/** Calendar helpers on UTC dates. PSD2 exchanges plain YYYY-MM-DD dates; results are at midnight UTC. */

const msPerDay = 86_400_000;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * msPerDay);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** The same day of the month `months` later, clamped to shorter months (Jan 31 + 1 month = Feb 28 or 29). */
export function addMonths(date: Date, months: number): Date {
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const year = firstOfTarget.getUTCFullYear();
  const month = firstOfTarget.getUTCMonth();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), daysInMonth(year, month))));
}

/** Calendar months from `from` to `to`, ignoring the day of the month (Jan 31 to Feb 1 is one month). */
export function calendarMonthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

/** Parses YYYY-MM-DD, or the date part of an ISO date-time. Null when it isn't a real calendar date. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return toIsoDate(date) === match[0] ? date : null;
}
