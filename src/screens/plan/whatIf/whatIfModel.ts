import {
  add,
  gel,
  isOutcomeAffordable,
  isOutcomeTight,
  subtract,
  type Money,
  type WhatIfInputs,
  type WhatIfOutcome,
  type WhatIfSimulator,
} from '../../../engine/index.ts';

export type WhatIfPreset = 'delivery' | 'saveMore' | 'loan' | 'income';

const PRESETS: readonly WhatIfPreset[] = ['delivery', 'saveMore', 'loan', 'income'];

/** The quick scenarios on offer; repaying a loan faster only makes sense when the bank reports one. */
export function availablePresets(hasLoan: boolean): WhatIfPreset[] {
  return PRESETS.filter((preset) => hasLoan || preset !== 'loan');
}

/** A preset applied to the current plan (WhatIfView.swift presets). */
export function presetInputs(preset: WhatIfPreset, baseline: WhatIfInputs): WhatIfInputs {
  switch (preset) {
    case 'delivery':
      return { ...baseline, deliveryCut: gel(50) };
    case 'saveMore':
      return { ...baseline, goalContribution: add(baseline.goalContribution, gel(50)) };
    case 'loan':
      return { ...baseline, extraLoanPayment: gel(100) };
    case 'income':
      return { ...baseline, incomeChangePercent: -10 };
  }
}

interface SliderRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** Slider ranges for each assumption: lari per month, and percent for income. */
export const ASSUMPTION_RANGES: Readonly<Record<keyof WhatIfInputs, SliderRange>> = {
  deliveryCut: { min: 0, max: 150, step: 5 },
  goalContribution: { min: 0, max: 1000, step: 10 },
  incomeChangePercent: { min: -30, max: 20, step: 5 },
  extraLoanPayment: { min: 0, max: 300, step: 10 },
};

/** "+10%", "−10%" or "0%". */
export function formatPercentChange(percent: number): string {
  return `${percent > 0 ? '+' : ''}${Math.trunc(percent)}%`;
}

export type PlanFit = 'fits' | 'tight' | 'doesNotFit';

/** Whether a scenario fits the month, with less than the comfortable cushion counting as tight. */
export function planFit(outcome: WhatIfOutcome): PlanFit {
  if (!isOutcomeAffordable(outcome)) return 'doesNotFit';
  return isOutcomeTight(outcome) ? 'tight' : 'fits';
}

export interface LoanVersusSavings {
  readonly interestSaved: Money;
  readonly monthsSooner: number;
  /** When the main goal would be reached if the same extra money went to it instead. */
  readonly goalCompletionWithSavings: Date | null;
}

/** Paying a loan faster compared with putting the same money toward the main goal. */
export function loanVersusSavings(
  simulator: WhatIfSimulator,
  extraPayment: Money,
  current: WhatIfOutcome,
  proposed: WhatIfOutcome,
): LoanVersusSavings {
  const baseline = simulator.baseline;
  const withSavings = simulator.outcome({ ...baseline, goalContribution: add(baseline.goalContribution, extraPayment) });
  return {
    interestSaved: subtract(current.loanInterestLeft, proposed.loanInterestLeft),
    monthsSooner: current.loanMonthsLeft - proposed.loanMonthsLeft,
    goalCompletionWithSavings: withSavings.goalCompletion,
  };
}
