import { describe, expect, it } from 'vitest';
import { createDisplay, EMPTY_HISTORY, gel, InsightBuilder, INSIGHT_KINDS, tbilisiDate } from '../../engine/index.ts';
import type { DailyTotal } from '../../engine/index.ts';
import { sampleFinance } from '../../engine/testFixtures.ts';
import { categoryShares, dailySpendingRows, insightBarRows, isInsightKind, noticedInsights } from './insightsModel.ts';

describe('isInsightKind', () => {
  it('accepts every insight kind and nothing else', () => {
    for (const kind of INSIGHT_KINDS) expect(isInsightKind(kind)).toBe(true);
    expect(isInsightKind('nonsense')).toBe(false);
    expect(isInsightKind(undefined)).toBe(false);
  });
});

describe('noticedInsights', () => {
  it('keeps the iOS order when every insight has data', () => {
    const builder = new InsightBuilder(sampleFinance(), createDisplay('en'), EMPTY_HISTORY);
    expect(noticedInsights(builder).map((content) => content.kind)).toEqual([...INSIGHT_KINDS]);
  });

  it('leaves out insights without transactions behind them', () => {
    const builder = new InsightBuilder(sampleFinance([]), createDisplay('en'), EMPTY_HISTORY);
    expect(noticedInsights(builder)).toEqual([]);
  });
});

describe('dailySpendingRows', () => {
  const day = (dayOfMonth: number, total: number): DailyTotal => ({ day: tbilisiDate(2026, 10, dayOfMonth, 0, 0), total: gel(total) });

  it('turns days into bars in lari', () => {
    expect(dailySpendingRows([day(1, 12.5), day(2, 0)])).toEqual([
      { time: tbilisiDate(2026, 10, 1, 0, 0).getTime(), value: 12.5, isBusiest: true },
      { time: tbilisiDate(2026, 10, 2, 0, 0).getTime(), value: 0, isBusiest: false },
    ]);
  });

  it('highlights the first day with the most spending', () => {
    const rows = dailySpendingRows([day(1, 10), day(2, 40), day(3, 40), day(4, 5)]);
    expect(rows.map((row) => row.isBusiest)).toEqual([false, true, false, false]);
  });

  it('highlights nothing when nothing was spent', () => {
    expect(dailySpendingRows([day(1, 0), day(2, 0)]).some((row) => row.isBusiest)).toBe(false);
    expect(dailySpendingRows([])).toEqual([]);
  });
});

describe('categoryShares', () => {
  it('measures the top categories against the largest', () => {
    const shares = categoryShares([
      { category: 'housing', total: gel(800) },
      { category: 'groceries', total: gel(200) },
      { category: 'transport', total: gel(100) },
    ]);
    expect(shares.map((item) => item.share)).toEqual([1, 0.25, 0.125]);
    expect(shares[1]).toEqual({ category: 'groceries', total: gel(200), share: 0.25 });
  });

  it('keeps only the largest few', () => {
    const totals = (['housing', 'groceries', 'transport', 'health', 'shopping', 'utilities'] as const).map((category, index) => ({
      category,
      total: gel(600 - index * 100),
    }));
    expect(categoryShares(totals).map((item) => item.category)).toEqual(['housing', 'groceries', 'transport', 'health', 'shopping']);
    expect(categoryShares(totals, 2)).toHaveLength(2);
  });

  it('is empty without spending', () => {
    expect(categoryShares([])).toEqual([]);
  });
});

describe('insightBarRows', () => {
  it('labels each bar with its amount', () => {
    const display = createDisplay('en');
    const rows = insightBarRows(
      [
        { id: 'bar-0', label: 'Sep', value: gel(118), isHighlighted: false },
        { id: 'bar-1', label: 'Oct', value: gel(185), isHighlighted: true },
      ],
      (value) => display.money(value, { precision: 'whole' }),
    );
    expect(rows).toEqual([
      { id: 'bar-0', label: 'Sep', value: 118, valueLabel: '118\u00A0₾', isHighlighted: false },
      { id: 'bar-1', label: 'Oct', value: 185, valueLabel: '185\u00A0₾', isHighlighted: true },
    ]);
  });
});
