import { describe, expect, it } from 'vitest';
import { addMonths, currentLoanTerms, gel, lt, sampleConverter, subtract, tbilisiDate, WhatIfSimulator } from '../../../engine/index.ts';
import type { SavingsGoal, WhatIfOutcome } from '../../../engine/index.ts';
import { FIXTURE_NOW as now, SAMPLE_BANK_LOAN, sampleBudget } from '../../../engine/testFixtures.ts';
import { availablePresets, formatPercentChange, loanVersusSavings, planFit, presetInputs } from './whatIfModel.ts';

const cushion: SavingsGoal = {
  id: 'cushion',
  name: lt('Safety cushion', 'ფინანსური ბალიში'),
  icon: 'shield',
  target: gel(4000),
  saved: gel(2650),
  targetDate: tbilisiDate(2026, 12, 31),
  monthlyContribution: gel(450),
  priority: 'high',
};

const simulator = new WhatIfSimulator(sampleBudget(), cushion, currentLoanTerms([SAMPLE_BANK_LOAN], sampleConverter), now);
const baseline = simulator.baseline;

describe('availablePresets', () => {
  it('offers every preset when there is a loan', () => {
    expect(availablePresets(true)).toEqual(['delivery', 'saveMore', 'loan', 'income']);
  });

  it('leaves out repaying a loan the bank did not report', () => {
    expect(availablePresets(false)).toEqual(['delivery', 'saveMore', 'income']);
  });
});

describe('presetInputs', () => {
  it('changes one assumption of the current plan', () => {
    expect(presetInputs('delivery', baseline)).toEqual({ ...baseline, deliveryCut: gel(50) });
    expect(presetInputs('saveMore', baseline)).toEqual({ ...baseline, goalContribution: gel(500) });
    expect(presetInputs('loan', baseline)).toEqual({ ...baseline, extraLoanPayment: gel(100) });
    expect(presetInputs('income', baseline)).toEqual({ ...baseline, incomeChangePercent: -10 });
  });
});

describe('formatPercentChange', () => {
  it('signs increases and keeps whole percents', () => {
    expect(formatPercentChange(15)).toBe('+15%');
    expect(formatPercentChange(-10)).toBe('-10%');
    expect(formatPercentChange(0)).toBe('0%');
  });
});

describe('planFit', () => {
  const outcome = (roomLeft: number): WhatIfOutcome => ({ ...simulator.outcome(baseline), roomLeft: gel(roomLeft) });

  it('fits with at least the comfortable cushion left', () => {
    expect(planFit(outcome(100))).toBe('fits');
    expect(planFit(outcome(314.43))).toBe('fits');
  });

  it('is tight with less than the cushion', () => {
    expect(planFit(outcome(99.99))).toBe('tight');
    expect(planFit(outcome(0))).toBe('tight');
  });

  it("doesn't fit when the month runs short", () => {
    expect(planFit(outcome(-0.01))).toBe('doesNotFit');
  });
});

describe('loanVersusSavings', () => {
  it('compares paying the loan faster with saving the same amount', () => {
    const current = simulator.outcome(baseline);
    const proposed = simulator.outcome({ ...baseline, extraLoanPayment: gel(100) });
    expect(loanVersusSavings(simulator, gel(100), current, proposed)).toEqual({
      interestSaved: subtract(current.loanInterestLeft, gel(756.86)),
      monthsSooner: 8,
      // 1,350 ₾ to go at 550 ₾ a month.
      goalCompletionWithSavings: addMonths(now, 3),
    });
  });
});
