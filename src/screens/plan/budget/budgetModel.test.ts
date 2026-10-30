import { describe, expect, it } from 'vitest';
import { add, gel, lt, MonthlyBudget, sampleConverter, usd } from '../../../engine/index.ts';
import type { UpcomingPayment } from '../../../engine/index.ts';
import { FIXTURE_NOW as now, sampleBudget } from '../../../engine/testFixtures.ts';
import { budgetSplit, upcomingTotal } from './budgetModel.ts';

describe('budgetSplit', () => {
  it('splits income into essentials, goals, flexible spending and room left', () => {
    const budget = sampleBudget();
    const split = budgetSplit(budget);
    expect(split.map((slice) => slice.part)).toEqual(['essentials', 'goals', 'flexible', 'room']);
    expect(split.map((slice) => slice.tint)).toEqual(['lavender', 'mint', 'coral', 'amber']);
    expect(split[0].amount).toEqual(budget.essentialTotal);
    expect(split[1].amount).toEqual(gel(1000));
    expect(split[1].share).toBeCloseTo(1000 / 3400);
  });

  it('adds up to the whole income when spending fits', () => {
    const budget = new MonthlyBudget({
      income: gel(1000),
      lines: [
        { category: 'housing', monthlyAmount: gel(400) },
        { category: 'shopping', monthlyAmount: gel(100) },
      ],
      savingsContributions: gel(200),
    });
    const split = budgetSplit(budget);
    expect(split.map((slice) => slice.share)).toEqual([0.4, 0.2, 0.1, 0.3]);
    expect(split.reduce((total, slice) => add(total, slice.amount), gel(0))).toEqual(gel(1000));
  });

  it('has no shares without income', () => {
    const budget = new MonthlyBudget({ income: gel(0), lines: [], savingsContributions: gel(0) });
    expect(budgetSplit(budget).every((slice) => slice.share === 0)).toBe(true);
  });
});

describe('upcomingTotal', () => {
  const payment = (id: string, amount: UpcomingPayment['amount']): UpcomingPayment => ({
    id,
    title: lt(id, id),
    category: 'subscriptions',
    amount,
    dueDate: now,
    isEstimate: false,
  });

  it('converts each payment to lari before adding', () => {
    const payments = [payment('rent', gel(850)), payment('netflix', usd(10))];
    expect(upcomingTotal(payments, sampleConverter)).toEqual(add(gel(850), sampleConverter.convert(usd(10), 'GEL')));
  });

  it('is zero with nothing due', () => {
    expect(upcomingTotal([], sampleConverter)).toEqual(gel(0));
  });
});
