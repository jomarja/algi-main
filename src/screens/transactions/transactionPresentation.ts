import type { CategoryAppearance, TransactionRowProps } from '../../design/index.ts';
import {
  CATEGORY_META,
  isIncome,
  multiply,
  signedAmount,
  subtract,
  sum,
  transactionSourceTitle,
  type CurrencyConverter,
  type Display,
  type FinanceTransaction,
  type Money,
  type SpendingCategoryId,
  type TransactionSource,
} from '../../engine/index.ts';

/** What a `TransactionRow` shows for a transaction; the caller adds where it leads. */
export type TransactionRowContent = Omit<TransactionRowProps, 'to' | 'onClick'>;

export const BANK_NAME = 'TBC Bank';

export function categoryAppearance(category: SpendingCategoryId): CategoryAppearance {
  const { icon, tint, background } = CATEGORY_META[category];
  return { icon, tint, background };
}

/**
 * Merchant, "Today · Groceries", and the signed amount in the currency it was charged in (TransactionRow.swift),
 * plus its value in the display currency when that differs. Pending bank items say so in the detail line.
 */
export function transactionRowContent(transaction: FinanceTransaction, display: Display, now: Date): TransactionRowContent {
  const signed = signedAmount(transaction);
  const details = [display.relativeDay(transaction.date, now), display.text(CATEGORY_META[transaction.category].title)];
  if (transaction.isPending) details.push(display.t('Pending', 'მოლოდინში'));
  return {
    merchant: transaction.merchant,
    detail: details.join(' · '),
    amount: display.original(signed, { sign: 'always' }),
    convertedAmount: transaction.amount.currency === display.currency ? undefined : display.money(signed),
    isIncome: isIncome(transaction),
    hasReceipt: transaction.hasReceipt,
    category: categoryAppearance(transaction.category),
  };
}

/** "TBC Bank · Everyday" for bank items, otherwise how it was added. */
export function transactionSourceText(source: TransactionSource, display: Display): string {
  if (source.kind !== 'bank') return display.text(transactionSourceTitle(source));
  const accountName = display.text(source.accountName).trim();
  return accountName ? `${BANK_NAME} · ${accountName}` : BANK_NAME;
}

/** A day's money in minus money out, in lari, for the day header of the transactions list. */
export function dayNetTotal(transactions: readonly FinanceTransaction[], converter: CurrencyConverter): Money {
  return sum(
    transactions.map((transaction) => converter.convert(signedAmount(transaction), 'GEL')),
    'GEL',
  );
}

/** The sample receipt's three item groups: illustrative splits that always add up to the real total. */
export function receiptLines(total: Money): Money[] {
  const first = multiply(total, 0.46);
  const second = multiply(total, 0.31);
  return [first, second, subtract(subtract(total, first), second)];
}
