import { AVERAGE_DAYS_PER_MONTH } from './calendar.ts';
import { compare, divide, majorUnits, minMoney, multiply, subtract, type Money } from './money.ts';

export type AllowanceImpact =
  | { readonly kind: 'withinAllowance' }
  /** Spending more today leaves less for each remaining day this week. */
  | { readonly kind: 'lowersLaterDays'; readonly newDaily: Money }
  /** Spending past the whole week's plan comes out of savings and pushes the goal back. */
  | { readonly kind: 'delaysGoal'; readonly days: number; readonly overspend: Money };

export interface DailyAllowanceInput {
  /** What's left of the week's day-to-day plan. */
  readonly weeklyRemaining: Money;
  /** Days left in the week, today included. */
  readonly daysLeft: number;
  /** Groceries, transport, and health per day, which stay protected. */
  readonly essentialDailyNeed: Money;
  /** Monthly contribution to the main goal, used to translate overspending into delay. */
  readonly monthlyGoalContribution: Money;
}

/**
 * "How much can I safely spend today and still stay on track?" An indicative amount from the week's
 * plan, never the bank balance: rent, bills, loan payments, and savings are already set aside.
 */
export class DailyAllowance {
  readonly weeklyRemaining: Money;
  readonly daysLeft: number;
  readonly essentialDailyNeed: Money;
  readonly monthlyGoalContribution: Money;

  constructor(input: DailyAllowanceInput) {
    this.weeklyRemaining = input.weeklyRemaining;
    this.daysLeft = input.daysLeft;
    this.essentialDailyNeed = input.essentialDailyNeed;
    this.monthlyGoalContribution = input.monthlyGoalContribution;
  }

  get today(): Money {
    return divide(this.weeklyRemaining, Math.max(this.daysLeft, 1));
  }

  get protectedForEssentials(): Money {
    return minMoney(multiply(this.essentialDailyNeed, Math.max(this.daysLeft, 0)), this.weeklyRemaining);
  }

  get flexibleLeft(): Money {
    return subtract(this.weeklyRemaining, this.protectedForEssentials);
  }

  impact(ofSpending: Money): AllowanceImpact {
    if (compare(ofSpending, this.today) <= 0) return { kind: 'withinAllowance' };
    if (compare(ofSpending, this.weeklyRemaining) <= 0) {
      const daysAfterToday = Math.max(this.daysLeft - 1, 1);
      return { kind: 'lowersLaterDays', newDaily: divide(subtract(this.weeklyRemaining, ofSpending), daysAfterToday) };
    }
    const overspend = subtract(ofSpending, this.weeklyRemaining);
    if (this.monthlyGoalContribution.minorUnits <= 0) return { kind: 'delaysGoal', days: 0, overspend };
    const days = Math.ceil((majorUnits(overspend) / majorUnits(this.monthlyGoalContribution)) * AVERAGE_DAYS_PER_MONTH);
    return { kind: 'delaysGoal', days, overspend };
  }
}
