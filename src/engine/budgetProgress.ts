import { add, fraction, isZero, maxMoney, multiply, subtract, zero, type Money } from './money.ts';

export type BudgetStatus = 'comfortable' | 'nearLimit' | 'over';

export const NEAR_LIMIT_THRESHOLD = 0.75;

/** How much of a spending limit has been used in a period. */
export class BudgetProgress {
  readonly limit: Money;
  readonly spent: Money;

  constructor(limit: Money, spent: Money) {
    this.limit = limit;
    this.spent = spent;
  }

  get remaining(): Money {
    return maxMoney(subtract(this.limit, this.spent), zero(this.limit.currency));
  }

  get overspent(): Money {
    return maxMoney(subtract(this.spent, this.limit), zero(this.limit.currency));
  }

  get fractionUsed(): number {
    return fraction(this.spent, this.limit);
  }

  get status(): BudgetStatus {
    if (isZero(this.limit)) return isZero(this.spent) ? 'comfortable' : 'over';
    if (this.fractionUsed >= 1) return 'over';
    return this.fractionUsed >= NEAR_LIMIT_THRESHOLD ? 'nearLimit' : 'comfortable';
  }

  /** Where spending lands by the end of the period if the recent daily pace continues. */
  projectedSpend(recentDailyPace: Money, daysLeft: number): Money {
    return add(this.spent, multiply(recentDailyPace, Math.max(daysLeft, 0)));
  }
}
