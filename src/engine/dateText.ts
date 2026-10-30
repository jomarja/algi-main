import { ALGI_TIME_ZONE, daysBetween } from './calendar.ts';
import { LANGUAGE_INFO, type AppLanguage } from './localization.ts';

export type DateStyle =
  | 'dayMonth'
  | 'dayMonthYear'
  | 'weekdayDayMonth'
  | 'weekdayShort'
  | 'monthYear'
  | 'month'
  | 'monthShort'
  | 'time';

/** Intl equivalents of the iOS DateFormatter templates, so both apps read CLDR's patterns for en_GB / ka_GE. */
const STYLE_OPTIONS: Readonly<Record<DateStyle, Intl.DateTimeFormatOptions>> = {
  dayMonth: { day: 'numeric', month: 'short' },
  dayMonthYear: { day: 'numeric', month: 'long', year: 'numeric' },
  weekdayDayMonth: { weekday: 'long', day: 'numeric', month: 'long' },
  weekdayShort: { weekday: 'short' },
  monthYear: { month: 'long', year: 'numeric' },
  month: { month: 'long' },
  monthShort: { month: 'short' },
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

export function formatDate(value: Date, style: DateStyle, language: AppLanguage): string {
  return formatter(style, language).format(value);
}

/** "Today", "Yesterday", a weekday within the past week, otherwise a short date. */
export function relativeDay(value: Date, now: Date, language: AppLanguage): string {
  const daysAgo = daysBetween(value, now);
  if (daysAgo === 0) return language === 'en' ? 'Today' : 'დღეს';
  if (daysAgo === 1) return language === 'en' ? 'Yesterday' : 'გუშინ';
  if (daysAgo >= 2 && daysAgo < 7) return formatDate(value, 'weekdayShort', language);
  return formatDate(value, 'dayMonth', language);
}

function formatter(style: DateStyle, language: AppLanguage): Intl.DateTimeFormat {
  const key = `${language}:${style}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat(LANGUAGE_INFO[language].locale, {
    ...STYLE_OPTIONS[style],
    timeZone: ALGI_TIME_ZONE,
  });
  formatters.set(key, created);
  return created;
}
