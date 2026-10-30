import { tbilisiDate } from './calendar.ts';
import { fromMinorUnits, type CurrencyCode, type Money } from './money.ts';
import { round } from './rounding.ts';

/**
 * Converts between currencies with a fixed rate table.
 * The sample table is illustrative: the UI must always label it as such and never present it as a live rate.
 */
export class CurrencyConverter {
  /** How many lari one unit of each currency is worth. */
  readonly gelPerUnit: Readonly<Record<CurrencyCode, number>>;
  readonly asOf: Date;
  readonly isIllustrative: boolean;

  constructor(gelPerUnit: Readonly<Record<CurrencyCode, number>>, asOf: Date, isIllustrative: boolean) {
    this.gelPerUnit = gelPerUnit;
    this.asOf = asOf;
    this.isIllustrative = isIllustrative;
  }

  rate(source: CurrencyCode, target: CurrencyCode): number {
    return this.gelPerUnit[source] / this.gelPerUnit[target];
  }

  convert(value: Money, target: CurrencyCode): Money {
    if (value.currency === target) return value;
    // Multiplying before dividing keeps the result exact for the two-decimal sample rates.
    const exact = (value.minorUnits * this.gelPerUnit[value.currency]) / this.gelPerUnit[target];
    return fromMinorUnits(round(exact), target);
  }

  /** One unit of `source` expressed in `target`, e.g. "1 USD = 2.70 ₾". */
  unitValue(source: CurrencyCode, target: CurrencyCode): Money {
    return this.convert(fromMinorUnits(100, source), target);
  }
}

/** The iOS app's sample rates, dated like its sample month (29 Oct 2026, 09:00 Tbilisi). */
export const sampleConverter = new CurrencyConverter(
  { GEL: 1, USD: 2.7, EUR: 2.92 },
  tbilisiDate(2026, 10, 29, 9, 0),
  true,
);
