import { dateParts } from './calendar.ts';
import type { Display } from './display.ts';

/**
 * The iOS copy named "August and September" outright. With bank data the months move, and Georgian
 * needs them in grammatical cases Intl doesn't provide, so the forms are listed here.
 */
interface GeorgianMonth {
  readonly nominative: string;
  readonly genitive: string;
  readonly dative: string;
}

const GEORGIAN_MONTHS: readonly GeorgianMonth[] = [
  { nominative: 'იანვარი', genitive: 'იანვრის', dative: 'იანვარს' },
  { nominative: 'თებერვალი', genitive: 'თებერვლის', dative: 'თებერვალს' },
  { nominative: 'მარტი', genitive: 'მარტის', dative: 'მარტს' },
  { nominative: 'აპრილი', genitive: 'აპრილის', dative: 'აპრილს' },
  { nominative: 'მაისი', genitive: 'მაისის', dative: 'მაისს' },
  { nominative: 'ივნისი', genitive: 'ივნისის', dative: 'ივნისს' },
  { nominative: 'ივლისი', genitive: 'ივლისის', dative: 'ივლისს' },
  { nominative: 'აგვისტო', genitive: 'აგვისტოს', dative: 'აგვისტოს' },
  { nominative: 'სექტემბერი', genitive: 'სექტემბრის', dative: 'სექტემბერს' },
  { nominative: 'ოქტომბერი', genitive: 'ოქტომბრის', dative: 'ოქტომბერს' },
  { nominative: 'ნოემბერი', genitive: 'ნოემბრის', dative: 'ნოემბერს' },
  { nominative: 'დეკემბერი', genitive: 'დეკემბრის', dative: 'დეკემბერს' },
];

function georgianMonth(month: Date): GeorgianMonth {
  return GEORGIAN_MONTHS[dateParts(month).month - 1];
}

function englishNames(months: readonly Date[], display: Display): string[] {
  return months.map((month) => display.date(month, 'month'));
}

/** "August and September" / „აგვისტოსა და სექტემბერს“, as in "compared them with …". */
export function monthsDative(months: readonly Date[], display: Display): string {
  if (months.length === 0) return display.t('previous months', 'წინა თვეებს');
  if (display.language === 'en') return display.list(englishNames(months, display));
  // All but the last month take the conjunctive -ა: „აგვისტოსა და სექტემბერს“.
  const datives = months.map((month) => georgianMonth(month).dative);
  const last = datives[datives.length - 1];
  const leading = datives.slice(0, -1).map((dative) => `${dative}ა`);
  return leading.length === 0 ? last : `${leading.join(', ')} და ${last}`;
}

/** "August and September" / „აგვისტო-სექტემბრის“, as in "your delivery totals for …". */
export function monthsGenitive(months: readonly Date[], display: Display): string {
  if (display.language === 'en') {
    return months.length === 0 ? 'previous months' : display.list(englishNames(months, display));
  }
  return georgianGenitiveRange(months);
}

/** "August–September" / „აგვისტო-სექტემბრის“, as in "your … average". */
export function monthRangeGenitive(months: readonly Date[], display: Display): string {
  if (display.language === 'en') {
    if (months.length === 0) return 'recent';
    const names = englishNames(months, display);
    return names.length === 1 ? names[0] : `${names[0]}–${names.at(-1)}`;
  }
  return georgianGenitiveRange(months);
}

function georgianGenitiveRange(months: readonly Date[]): string {
  const first = months.at(0);
  const last = months.at(-1);
  if (!first || !last) return 'წინა თვეების';
  if (months.length === 1) return georgianMonth(last).genitive;
  // Compounds put the first month in its stem form: "აგვისტო-სექტემბრის", "სექტემბერ-ოქტომბრის".
  const stem = georgianMonth(first).nominative.replace(/ი$/, '');
  return `${stem}-${georgianMonth(last).genitive}`;
}
