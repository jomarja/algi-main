import { LoanCalculator, type LoanTerms } from './loan.ts';
import { add, compare, gel, minMoney, multiply, subtract, zero, type Money } from './money.ts';
import type { MonthlyBudget } from './monthlyBudget.ts';
import { GoalProjection, type SavingsGoal } from './savingsGoal.ts';

/** The assumptions a user can change. Everything else comes from their data. */
export interface WhatIfInputs {
  /** Less spent on food delivery each month; assumed to go to the main goal. */
  readonly deliveryCut: Money;
  /** Monthly contribution to the main goal. */
  readonly goalContribution: Money;
  /** Income change, e.g. -10 for a 10% drop. */
  readonly incomeChangePercent: number;
  readonly extraLoanPayment: Money;
}

export interface WhatIfOutcome {
  /** Money left each month after essentials, savings, and usual flexible spending. */
  readonly roomLeft: Money;
  readonly goalMonthly: Money;
  readonly goalCompletion: Date | null;
  readonly savedInTwelveMonths: Money;
  readonly loanMonthsLeft: number;
  readonly loanInterestLeft: Money;
}

/** A scenario the user chose to keep, for side-by-side comparison. */
export interface SavedPlan {
  readonly id: string;
  readonly name: string;
  readonly inputs: WhatIfInputs;
  readonly outcome: WhatIfOutcome;
}

export const COMFORTABLE_ROOM = gel(100);

export function isOutcomeAffordable(outcome: WhatIfOutcome): boolean {
  return outcome.roomLeft.minorUnits >= 0;
}

export function isOutcomeTight(outcome: WhatIfOutcome): boolean {
  return compare(outcome.roomLeft, COMFORTABLE_ROOM) < 0;
}

/** Compares the current plan with a proposed one: savings, room to spend, debt, and goal timing. */
export class WhatIfSimulator {
  readonly budget: MonthlyBudget;
  readonly goal: SavingsGoal;
  /** Null when the bank reports no loan; debt figures then stay at zero. */
  readonly loan: LoanTerms | null;
  readonly now: Date;

  constructor(budget: MonthlyBudget, goal: SavingsGoal, loan: LoanTerms | null, now: Date) {
    this.budget = budget;
    this.goal = goal;
    this.loan = loan;
    this.now = now;
  }

  get baseline(): WhatIfInputs {
    return {
      deliveryCut: zero('GEL'),
      goalContribution: this.goal.monthlyContribution,
      incomeChangePercent: 0,
      extraLoanPayment: zero('GEL'),
    };
  }

  outcome(inputs: WhatIfInputs): WhatIfOutcome {
    const incomeChange = multiply(this.budget.income, inputs.incomeChangePercent / 100);
    const extraContribution = subtract(inputs.goalContribution, this.goal.monthlyContribution);
    const roomLeft = subtract(subtract(add(this.budget.unplannedRoom, incomeChange), extraContribution), inputs.extraLoanPayment);

    const goalMonthly = add(inputs.goalContribution, inputs.deliveryCut);
    const projection = new GoalProjection({ ...this.goal, monthlyContribution: goalMonthly }, this.now);
    const payoff = this.loan ? LoanCalculator.payoff(this.loan, inputs.extraLoanPayment) : null;

    return {
      roomLeft,
      goalMonthly,
      goalCompletion: projection.completionDate(goalMonthly),
      savedInTwelveMonths: minMoney(multiply(goalMonthly, 12), projection.remaining),
      loanMonthsLeft: payoff?.months ?? this.loan?.months ?? 0,
      loanInterestLeft: payoff?.interest ?? zero('GEL'),
    };
  }
}
