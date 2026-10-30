import { zero, type Money } from './money.ts';

export interface MonthlyTotal {
  /** Start of the month. */
  readonly month: Date;
  readonly total: Money;
}

/**
 * Aggregates that need more than this month's transactions. The iOS prototype hard-coded them;
 * the web app derives them from the bank's transaction history (see `deriveSpendingHistory`).
 */
export interface SpendingHistory {
  /** Months before the current one that the bank data fully covers, oldest first. */
  readonly completeMonths: readonly Date[];
  /** Null when the bank data doesn't reach back to last month. */
  readonly previousMonthSpending: Money | null;
  /** Food delivery in up to the last two complete months, oldest first. */
  readonly deliveryByMonth: readonly MonthlyTotal[];
  readonly weekdayFoodDailyAverage: Money;
  readonly weekendFoodDailyAverage: Money;
  readonly typicalShoppingPurchase: Money | null;
  /** Consecutive months with more coming in than going out, up to this month. */
  readonly savingStreakMonths: number;
  readonly bestSavingMonth: MonthlyTotal | null;
}

export const EMPTY_HISTORY: SpendingHistory = {
  completeMonths: [],
  previousMonthSpending: null,
  deliveryByMonth: [],
  weekdayFoodDailyAverage: zero('GEL'),
  weekendFoodDailyAverage: zero('GEL'),
  typicalShoppingPurchase: null,
  savingStreakMonths: 0,
  bestSavingMonth: null,
};
