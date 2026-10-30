import { describe, expect, it } from 'vitest';
import { gel, goalRequest, GoalPlanner, MonthlyBudget, subtract } from '../../../engine/index.ts';
import { FIXTURE_NOW as now, sampleBudget } from '../../../engine/testFixtures.ts';
import { customMonthlyMax, ownershipSummary } from './plannerModel.ts';

describe('customMonthlyMax', () => {
  it('reaches half again past the most that can be saved', () => {
    // The sample budget allows at most 545 ₾ a month.
    expect(customMonthlyMax(new GoalPlanner(sampleBudget(), now))).toBe(817.5);
  });

  it('never drops below 100 ₾', () => {
    const empty = new MonthlyBudget({ income: gel(0), lines: [], savingsContributions: gel(0) });
    expect(customMonthlyMax(new GoalPlanner(empty, now))).toBe(100);
  });
});

describe('ownershipSummary', () => {
  const budget = sampleBudget();

  it('adds up what owning a car costs and what flexible money is left', () => {
    const summary = ownershipSummary(goalRequest('car', gel(15000)), budget);
    expect(summary?.costs.insurancePerMonth).toEqual(gel(50));
    expect(summary?.monthlyTotal).toEqual(gel(182.5));
    expect(summary?.flexible).toEqual(budget.flexibleAllowance);
    expect(summary?.afterPurchase).toEqual(subtract(budget.flexibleAllowance, gel(182.5)));
  });

  it('is null for goals without running costs', () => {
    expect(ownershipSummary(goalRequest('holiday', gel(1500)), budget)).toBeNull();
  });
});
