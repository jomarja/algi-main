import { intervalContains, startOfDay, type DateInterval } from './calendar.ts';
import { CATEGORY_META, type SpendingCategoryId } from './categories.ts';
import type { FinanceSummary } from './financeSummary.ts';
import { isIncome, type FinanceTransaction } from './transactions.ts';

export type TransactionPeriod = 'thisWeek' | 'thisMonth' | 'allTime';
export type TransactionTypeFilter = 'all' | 'expenses' | 'income';

export interface TransactionFilter {
  readonly period: TransactionPeriod;
  readonly type: TransactionTypeFilter;
  readonly category: SpendingCategoryId | null;
  readonly query: string;
}

export interface DayGroup {
  readonly day: Date;
  readonly transactions: readonly FinanceTransaction[];
}

/** The transactions list after filters and search, newest first. */
export function filterTransactions(finance: FinanceSummary, filter: TransactionFilter): FinanceTransaction[] {
  const interval = periodInterval(finance, filter.period);
  const query = filter.query.trim();
  return finance.recentTransactions.filter(
    (transaction) =>
      matchesType(transaction, filter.type) &&
      (interval === null || intervalContains(interval, transaction.date)) &&
      (filter.category === null || transaction.category === filter.category) &&
      (query === '' || matchesQuery(transaction, query)),
  );
}

/** Groups transactions by calendar day, newest day first. */
export function groupTransactionsByDay(transactions: readonly FinanceTransaction[]): DayGroup[] {
  const groups = new Map<number, FinanceTransaction[]>();
  for (const transaction of transactions) {
    const day = startOfDay(transaction.date).getTime();
    const group = groups.get(day);
    if (group) group.push(transaction);
    else groups.set(day, [transaction]);
  }
  return [...groups]
    .map(([day, grouped]) => ({ day: new Date(day), transactions: grouped }))
    .sort((lhs, rhs) => rhs.day.getTime() - lhs.day.getTime());
}

function periodInterval(finance: FinanceSummary, period: TransactionPeriod): DateInterval | null {
  switch (period) {
    case 'thisWeek':
      return finance.currentWeek;
    case 'thisMonth':
      return finance.currentMonth;
    case 'allTime':
      return null;
  }
}

function matchesType(transaction: FinanceTransaction, type: TransactionTypeFilter): boolean {
  switch (type) {
    case 'all':
      return true;
    case 'expenses':
      return !isIncome(transaction);
    case 'income':
      return isIncome(transaction);
  }
}

function matchesQuery(transaction: FinanceTransaction, query: string): boolean {
  const { title } = CATEGORY_META[transaction.category];
  const needle = query.toLocaleLowerCase();
  return [transaction.merchant, title.en, title.ka].some((text) => text.toLocaleLowerCase().includes(needle));
}
