import {
  lt,
  type LocalizedText,
  type TransactionFilter,
  type TransactionPeriod,
  type TransactionTypeFilter,
} from '../../engine/index.ts';

/** The transactions list's filters and their titles (TransactionsView.TypeFilter / Period). */

export const TRANSACTION_TYPES: readonly TransactionTypeFilter[] = ['all', 'expenses', 'income'];
export const TRANSACTION_PERIODS: readonly TransactionPeriod[] = ['thisWeek', 'thisMonth', 'allTime'];

export const TRANSACTION_TYPE_TITLES: Readonly<Record<TransactionTypeFilter, LocalizedText>> = {
  all: lt('All', 'ყველა'),
  expenses: lt('Expenses', 'ხარჯები'),
  income: lt('Income', 'შემოსავალი'),
};

export const TRANSACTION_PERIOD_TITLES: Readonly<Record<TransactionPeriod, LocalizedText>> = {
  thisWeek: lt('This week', 'ეს კვირა'),
  thisMonth: lt('This month', 'ეს თვე'),
  allTime: lt('All time', 'მთელი პერიოდი'),
};

export const DEFAULT_TRANSACTION_FILTER: TransactionFilter = {
  period: 'thisMonth',
  type: 'all',
  category: null,
  query: '',
};
