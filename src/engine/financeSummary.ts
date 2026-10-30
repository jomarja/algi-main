import { BudgetProgress } from './budgetProgress.ts';
import {
  addDays,
  dayInterval,
  daysBetween,
  daysInMonth,
  dateParts,
  intervalContains,
  monthInterval,
  startOfDay,
  weekInterval,
  type DateInterval,
} from './calendar.ts';
import { CATEGORY_META, type SpendingCategoryId } from './categories.ts';
import { sampleConverter, type CurrencyConverter } from './currencyConverter.ts';
import { compare, divide, sum, type Money } from './money.ts';
import { isIncome, type Account, type FinanceTransaction } from './transactions.ts';

export interface CategoryTotal {
  readonly category: SpendingCategoryId;
  readonly total: Money;
}

export interface DailyTotal {
  readonly day: Date;
  readonly total: Money;
}

export interface SpendingFilter {
  readonly category?: SpendingCategoryId | null;
  /** Leaves out rent, bills, and loan payments. */
  readonly excludingFixedCosts?: boolean;
}

export interface FinanceSummaryInput {
  readonly accounts: readonly Account[];
  readonly transactions: readonly FinanceTransaction[];
  readonly monthlyPlan: Money;
  readonly weeklyPlan: Money;
  readonly deliveryMonthlyBudget: Money;
  readonly now: Date;
  readonly converter?: CurrencyConverter;
}

/**
 * Read-only calculations over the user's accounts, transactions, and plans.
 * All totals are reported in GEL; foreign-currency amounts are converted with `converter`.
 */
export class FinanceSummary {
  readonly accounts: readonly Account[];
  readonly transactions: readonly FinanceTransaction[];
  readonly monthlyPlan: Money;
  readonly weeklyPlan: Money;
  readonly deliveryMonthlyBudget: Money;
  readonly now: Date;
  readonly converter: CurrencyConverter;

  constructor(input: FinanceSummaryInput) {
    this.accounts = input.accounts;
    this.transactions = input.transactions;
    this.monthlyPlan = input.monthlyPlan;
    this.weeklyPlan = input.weeklyPlan;
    this.deliveryMonthlyBudget = input.deliveryMonthlyBudget;
    this.now = input.now;
    this.converter = input.converter ?? sampleConverter;
  }

  // Periods

  get currentMonth(): DateInterval {
    return monthInterval(this.now);
  }

  get currentWeek(): DateInterval {
    return weekInterval(this.now);
  }

  get lastSevenDays(): DateInterval {
    return { start: addDays(this.now, -7), end: this.now };
  }

  /** Days left in the week, today included. */
  get daysLeftInWeek(): number {
    return Math.max(daysBetween(this.now, this.currentWeek.end), 1);
  }

  /** Full days left in the month after today. */
  get daysLeftInMonth(): number {
    return daysInMonth(this.now) - dateParts(this.now).day;
  }

  // Balances and plans

  get totalBalance(): Money {
    return sum(this.accounts.map((account) => this.converter.convert(account.balance, 'GEL')), 'GEL');
  }

  get monthlyIncome(): Money {
    return this.total(this.incomes(this.currentMonth));
  }

  get monthlySpending(): Money {
    return this.spending(this.currentMonth);
  }

  get monthlyPlanProgress(): BudgetProgress {
    return new BudgetProgress(this.monthlyPlan, this.monthlySpending);
  }

  /** Discretionary spending this week against the weekly plan; fixed costs are excluded. */
  get weeklyPlanProgress(): BudgetProgress {
    return new BudgetProgress(this.weeklyPlan, this.spending(this.currentWeek, { excludingFixedCosts: true }));
  }

  get safeToSpendThisWeek(): Money {
    return this.weeklyPlanProgress.remaining;
  }

  get dailyAllowance(): Money {
    return divide(this.safeToSpendThisWeek, this.daysLeftInWeek);
  }

  get deliveryBudget(): BudgetProgress {
    return new BudgetProgress(this.deliveryMonthlyBudget, this.spending(this.currentMonth, { category: 'foodDelivery' }));
  }

  get deliveryDailyPace(): Money {
    return divide(this.spending(this.lastSevenDays, { category: 'foodDelivery' }), 7);
  }

  get projectedDeliverySpend(): Money {
    return this.deliveryBudget.projectedSpend(this.deliveryDailyPace, this.daysLeftInMonth);
  }

  // Transactions

  /** Newest first; same-day bank items keep the bank's own order. */
  get recentTransactions(): FinanceTransaction[] {
    return [...this.transactions].sort((lhs, rhs) => rhs.date.getTime() - lhs.date.getTime());
  }

  expenses(interval: DateInterval, category: SpendingCategoryId | null = null): FinanceTransaction[] {
    return this.transactions.filter(
      (transaction) =>
        !isIncome(transaction) &&
        intervalContains(interval, transaction.date) &&
        (category === null || transaction.category === category),
    );
  }

  incomes(interval: DateInterval): FinanceTransaction[] {
    return this.transactions.filter((transaction) => isIncome(transaction) && intervalContains(interval, transaction.date));
  }

  spending(interval: DateInterval, filter: SpendingFilter = {}): Money {
    const matching = this.expenses(interval, filter.category ?? null).filter(
      (transaction) => !filter.excludingFixedCosts || !CATEGORY_META[transaction.category].isFixedCost,
    );
    return this.total(matching);
  }

  gelAmount(transaction: FinanceTransaction): Money {
    return this.converter.convert(transaction.amount, 'GEL');
  }

  categoryTotals(interval: DateInterval): CategoryTotal[] {
    const grouped = new Map<SpendingCategoryId, FinanceTransaction[]>();
    for (const transaction of this.expenses(interval)) {
      const group = grouped.get(transaction.category);
      if (group) group.push(transaction);
      else grouped.set(transaction.category, [transaction]);
    }
    return [...grouped]
      .map(([category, transactions]) => ({ category, total: this.total(transactions) }))
      .sort((lhs, rhs) => compare(rhs.total, lhs.total));
  }

  /** Spending per calendar day up to today, without fixed costs so rent doesn't dwarf everyday habits. */
  dailySpending(interval: DateInterval): DailyTotal[] {
    const totals: DailyTotal[] = [];
    const lastDay = Math.min(this.now.getTime(), interval.end.getTime() - 1);
    for (let day = startOfDay(interval.start); day.getTime() <= lastDay; day = addDays(day, 1)) {
      totals.push({ day, total: this.spending(dayInterval(day), { excludingFixedCosts: true }) });
    }
    return totals;
  }

  transactionsFrom(merchant: string, interval: DateInterval): FinanceTransaction[] {
    return this.expenses(interval).filter((transaction) => transaction.merchant === merchant);
  }

  /** Converts each transaction to lari before adding, like the iOS app. */
  total(transactions: readonly FinanceTransaction[]): Money {
    return sum(transactions.map((transaction) => this.gelAmount(transaction)), 'GEL');
  }
}
