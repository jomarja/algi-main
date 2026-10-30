import {
  fraction,
  sum,
  type CurrencyConverter,
  type Money,
  type MonthlyBudget,
  type PaletteToken,
  type UpcomingPayment,
} from '../../../engine/index.ts';

export type BudgetPart = 'essentials' | 'goals' | 'flexible' | 'room';

export interface BudgetSlice {
  readonly part: BudgetPart;
  readonly amount: Money;
  /** Share of income, 0…1 (can exceed 1 together when spending outgrows income). */
  readonly share: number;
  readonly tint: PaletteToken;
}

const TINTS: Readonly<Record<BudgetPart, PaletteToken>> = {
  essentials: 'lavender',
  goals: 'mint',
  flexible: 'coral',
  room: 'amber',
};

/** How a typical month's income splits into essentials, goals, flexible spending and what's left. */
export function budgetSplit(budget: MonthlyBudget): BudgetSlice[] {
  const amounts: ReadonlyArray<readonly [BudgetPart, Money]> = [
    ['essentials', budget.essentialTotal],
    ['goals', budget.savingsContributions],
    ['flexible', budget.flexibleTotal],
    ['room', budget.unplannedRoom],
  ];
  return amounts.map(([part, amount]) => ({ part, amount, share: Math.max(fraction(amount, budget.income), 0), tint: TINTS[part] }));
}

/** Everything due before payday in lari, whatever currency each payment is charged in. */
export function upcomingTotal(payments: readonly UpcomingPayment[], converter: CurrencyConverter): Money {
  return sum(
    payments.map((payment) => converter.convert(payment.amount, 'GEL')),
    'GEL',
  );
}
