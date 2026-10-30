import { describe, expect, it } from 'vitest';
import {
  addMonths,
  daysBetween,
  isoDay,
  monthKey,
  nextMonthlyDate,
  parseIsoDay,
  startOfDay,
  tbilisiDate,
  weekInterval,
} from './calendar.ts';
import { formatDate, relativeDay } from './dateText.ts';
import { createDisplay } from './display.ts';
import { greetingText } from './greeting.ts';
import { APP_LANGUAGES, LANGUAGE_INFO, joinList, lt, resolveText } from './localization.ts';
import { gel } from './money.ts';
import { NON_BREAKING_SPACE } from './moneyFormatter.ts';
import { FIXTURE_NOW as now } from './testFixtures.ts';

describe('Localization', () => {
  it('resolves copy for each language', () => {
    const text = lt('Goals', 'მიზნები');
    expect(resolveText(text, 'en')).toBe('Goals');
    expect(resolveText(text, 'ka')).toBe('მიზნები');
  });

  it('display picks the active language', () => {
    expect(createDisplay('en').t('Home', 'მთავარი')).toBe('Home');
    expect(createDisplay('ka').t('Home', 'მთავარი')).toBe('მთავარი');
    expect(createDisplay('ka').text(lt('Home', 'მთავარი'))).toBe('მთავარი');
  });

  it('display converts to the display currency', () => {
    const display = createDisplay('en', 'USD');
    expect(display.money(gel(27))).toBe('$10.00');
    expect(display.original(gel(27))).toBe(`27.00${NON_BREAKING_SPACE}₾`);
  });

  it('describes recent days relatively', () => {
    const yesterday = tbilisiDate(2026, 10, 28, 20, 0);
    expect(relativeDay(now, now, 'en')).toBe('Today');
    expect(relativeDay(yesterday, now, 'en')).toBe('Yesterday');
    expect(relativeDay(now, now, 'ka')).toBe('დღეს');
    expect(relativeDay(yesterday, now, 'ka')).toBe('გუშინ');
    expect(createDisplay('en').relativeDay(tbilisiDate(2026, 10, 26), now)).toBe(formatDate(tbilisiDate(2026, 10, 26), 'weekdayShort', 'en'));
    expect(relativeDay(tbilisiDate(2026, 10, 1), now, 'en')).toBe('1 Oct');
  });

  it('formats dates in Tbilisi time with the British English patterns', () => {
    expect(formatDate(now, 'dayMonth', 'en')).toBe('29 Oct');
    expect(formatDate(now, 'dayMonthYear', 'en')).toBe('29 October 2026');
    expect(formatDate(now, 'monthYear', 'en')).toBe('October 2026');
    expect(formatDate(now, 'month', 'en')).toBe('October');
    expect(formatDate(now, 'time', 'en')).toBe('09:00');
    expect(formatDate(now, 'weekdayDayMonth', 'en')).toContain('Thursday');
    expect(formatDate(now, 'month', 'ka')).toBe('ოქტომბერი');
    // 23:30 in Tbilisi is still the 29th even though it is 19:30 UTC.
    expect(formatDate(tbilisiDate(2026, 10, 29, 23, 30), 'dayMonth', 'en')).toBe('29 Oct');
  });

  it('joins lists the way each language does', () => {
    expect(joinList(['Netflix', 'Spotify', 'iCloud+'], 'en')).toBe('Netflix, Spotify and iCloud+');
    expect(createDisplay('ka').list(['A', 'B'])).toBe('A და B');
  });

  it.each([
    [9, 'Good morning'],
    [13, 'Good afternoon'],
    [20, 'Good evening'],
    [3, 'Good evening'],
  ])('greets by time of day at %i:00', (hour, expected) => {
    expect(greetingText(hour).en).toBe(expected);
  });

  it('every language has a native name', () => {
    expect(APP_LANGUAGES.map((language) => LANGUAGE_INFO[language].nativeName)).toEqual(['English', 'ქართული']);
  });
});

describe('Calendar', () => {
  it('uses Monday-first weeks in Tbilisi', () => {
    const week = weekInterval(now);
    expect(week.start).toEqual(tbilisiDate(2026, 10, 26, 0, 0));
    expect(week.end).toEqual(tbilisiDate(2026, 11, 2, 0, 0));
  });

  it('adds months like Foundation, clamping to the end of shorter months', () => {
    expect(addMonths(now, 3)).toEqual(tbilisiDate(2027, 1, 29, 9, 0));
    expect(addMonths(tbilisiDate(2026, 1, 31, 9, 0), 1)).toEqual(tbilisiDate(2026, 2, 28, 9, 0));
    expect(addMonths(tbilisiDate(2026, 3, 31), -1)).toEqual(tbilisiDate(2026, 2, 28));
  });

  it('counts whole calendar days between dates', () => {
    expect(daysBetween(now, tbilisiDate(2026, 12, 31))).toBe(63);
    expect(daysBetween(tbilisiDate(2026, 10, 28, 23, 0), tbilisiDate(2026, 10, 29, 1, 0))).toBe(1);
    expect(startOfDay(now)).toEqual(tbilisiDate(2026, 10, 29, 0, 0));
  });

  it('reads and writes ISO days', () => {
    expect(parseIsoDay('2026-10-05')).toEqual(tbilisiDate(2026, 10, 5, 0, 0));
    expect(parseIsoDay('2026-02-30')).toBeNull();
    expect(parseIsoDay('05.10.2026')).toBeNull();
    expect(isoDay(now)).toBe('2026-10-29');
    expect(monthKey(now)).toBe('2026-10');
  });

  it('finds the next monthly date on or after a day', () => {
    expect(nextMonthlyDate(tbilisiDate(2026, 10, 1, 0, 0), now)).toEqual(tbilisiDate(2026, 11, 1, 0, 0));
    expect(nextMonthlyDate(tbilisiDate(2026, 9, 29, 0, 0), now)).toEqual(tbilisiDate(2026, 10, 29, 0, 0));
    expect(nextMonthlyDate(tbilisiDate(2026, 8, 15, 0, 0), now)).toEqual(tbilisiDate(2026, 11, 15, 0, 0));
  });
});
