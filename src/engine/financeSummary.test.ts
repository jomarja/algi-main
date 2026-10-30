import { describe, expect, it } from 'vitest';
import { CATEGORY_META } from './categories.ts';
import { gel, zero } from './money.ts';
import { sampleFinance as summary } from './testFixtures.ts';

describe('FinanceSummary', () => {
  it('totals balances across accounts', () => {
    expect(summary().totalBalance).toEqual(gel(17_336.4));
  });

  it('totals monthly income and spending in lari', () => {
    const finance = summary();
    expect(finance.monthlyIncome).toEqual(gel(3400));
    expect(finance.monthlySpending).toEqual(gel(2158.97));
    expect(finance.monthlyPlanProgress.remaining).toEqual(gel(241.03));
  });

  it('excludes fixed costs from the weekly plan', () => {
    const finance = summary();
    expect(finance.weeklyPlanProgress.spent).toEqual(gel(157.3));
    expect(finance.safeToSpendThisWeek).toEqual(gel(122.7));
  });

  it('spreads the weekly amount over the days left', () => {
    const finance = summary();
    expect(finance.daysLeftInWeek).toBe(4);
    expect(finance.dailyAllowance).toEqual(gel(30.68));
  });

  it('treats loan payments as fixed costs', () => {
    const finance = summary();
    expect(finance.spending(finance.currentMonth, { category: 'debt' })).toEqual(gel(243.44));
    expect(CATEGORY_META.debt.isFixedCost).toBe(true);
  });

  it('counts days left in the month', () => {
    expect(summary().daysLeftInMonth).toBe(2);
  });

  it('tracks the delivery budget and projection', () => {
    const finance = summary();
    expect(finance.deliveryBudget.spent).toEqual(gel(185));
    expect(finance.deliveryBudget.status).toBe('nearLimit');
    expect(finance.deliveryDailyPace).toEqual(gel(15.19));
    expect(finance.projectedDeliverySpend).toEqual(gel(215.38));
  });

  it('ranks categories by total', () => {
    const finance = summary();
    const totals = finance.categoryTotals(finance.currentMonth);
    expect(totals[0].category).toBe('housing');
    expect(totals.some((total) => total.category === 'income')).toBe(false);
  });

  it('reports one daily total per day so far without fixed costs', () => {
    const finance = summary();
    const daily = finance.dailySpending(finance.currentMonth);
    expect(daily).toHaveLength(29);
    expect(daily[0].total).toEqual(zero('GEL'));
  });

  it('sorts recent transactions newest first', () => {
    const recent = summary().recentTransactions;
    expect(recent[0].merchant).toBe('Coffee Lab');
    const isNewestFirst = recent.every(
      (transaction, index) => index === 0 || recent[index - 1].date.getTime() >= transaction.date.getTime(),
    );
    expect(isNewestFirst).toBe(true);
  });

  it('handles no transactions', () => {
    const finance = summary([]);
    expect(finance.monthlySpending).toEqual(zero('GEL'));
    expect(finance.safeToSpendThisWeek).toEqual(gel(280));
    expect(finance.categoryTotals(finance.currentMonth)).toEqual([]);
  });
});
