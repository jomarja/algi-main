import { describe, expect, it } from 'vitest';
import { BudgetProgress } from './budgetProgress.ts';
import { gel, zero } from './money.ts';

describe('BudgetProgress', () => {
  it('reports remaining and near limit', () => {
    const budget = new BudgetProgress(gel(200), gel(185));
    expect(budget.remaining).toEqual(gel(15));
    expect(budget.overspent).toEqual(zero('GEL'));
    expect(budget.fractionUsed).toBe(0.925);
    expect(budget.status).toBe('nearLimit');
  });

  it('is comfortable below the threshold', () => {
    expect(new BudgetProgress(gel(200), gel(100)).status).toBe('comfortable');
  });

  it('treats reaching the limit as used up', () => {
    expect(new BudgetProgress(gel(200), gel(200)).status).toBe('over');
  });

  it('reports overspending without negative remaining', () => {
    const budget = new BudgetProgress(gel(200), gel(250));
    expect(budget.remaining).toEqual(zero('GEL'));
    expect(budget.overspent).toEqual(gel(50));
    expect(budget.status).toBe('over');
  });

  it('handles a zero limit', () => {
    expect(new BudgetProgress(zero('GEL'), zero('GEL')).status).toBe('comfortable');
    expect(new BudgetProgress(zero('GEL'), gel(1)).status).toBe('over');
  });

  it('projects spend from the recent pace', () => {
    const budget = new BudgetProgress(gel(200), gel(185));
    expect(budget.projectedSpend(gel(15.19), 2)).toEqual(gel(215.38));
    expect(budget.projectedSpend(gel(15.19), -1)).toEqual(gel(185));
  });
});
