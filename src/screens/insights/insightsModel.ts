import {
  fraction,
  INSIGHT_KINDS,
  majorUnits,
  type CategoryTotal,
  type DailyTotal,
  type InsightBar,
  type InsightBuilder,
  type InsightContent,
  type InsightKind,
  type Money,
  type SpendingCategoryId,
} from '../../engine/index.ts';

/** `/insights/:insightId` names an InsightKind. */
export function isInsightKind(value: string | undefined): value is InsightKind {
  return INSIGHT_KINDS.some((kind) => kind === value);
}

/**
 * What Luka noticed, in the iOS order. An insight with no transactions behind it has nothing to say yet
 * (e.g. no subscriptions this month), so it's left out.
 */
export function noticedInsights(builder: Pick<InsightBuilder, 'content'>): InsightContent[] {
  return INSIGHT_KINDS.map((kind) => builder.content(kind)).filter((content) => content.relatedTransactions.length > 0);
}

export interface DailyBarRow {
  readonly time: number;
  /** Lari spent that day. */
  readonly value: number;
  /** The day with the most spending, drawn in ink. */
  readonly isBusiest: boolean;
}

/** Days of the month so far as chart bars; the first day with the highest spending stands out. */
export function dailySpendingRows(daily: readonly DailyTotal[]): DailyBarRow[] {
  const busiest = daily.reduce<number | null>(
    (best, day, index) => (day.total.minorUnits > (best === null ? 0 : daily[best].total.minorUnits) ? index : best),
    null,
  );
  return daily.map((day, index) => ({ time: day.day.getTime(), value: majorUnits(day.total), isBusiest: index === busiest }));
}

export interface CategoryShare {
  readonly category: SpendingCategoryId;
  readonly total: Money;
  /** Relative to the largest category, 0…1, for the bar length. */
  readonly share: number;
}

/** The largest categories this month, each measured against the biggest one. */
export function categoryShares(totals: readonly CategoryTotal[], limit = 5): CategoryShare[] {
  const top = totals.slice(0, limit);
  const largest = top[0]?.total;
  return top.map(({ category, total }) => ({ category, total, share: largest ? fraction(total, largest) : 0 }));
}

export interface InsightBarRow {
  readonly id: string;
  readonly label: string;
  /** Lari, for the bar height. */
  readonly value: number;
  /** The amount written above the bar. */
  readonly valueLabel: string;
  readonly isHighlighted: boolean;
}

/** An insight's bars as chart rows, each labelled with its formatted amount. */
export function insightBarRows(bars: readonly InsightBar[], formatMoney: (value: Money) => string): InsightBarRow[] {
  return bars.map((bar) => ({
    id: bar.id,
    label: bar.label,
    value: majorUnits(bar.value),
    valueLabel: formatMoney(bar.value),
    isHighlighted: bar.isHighlighted,
  }));
}
