import type { BankAccount } from '../../shared/bank.ts';
import type { SpendingCategoryId } from './categories.ts';
import { newId } from './ids.ts';
import { lt, type LocalizedText } from './localization.ts';
import { isZero, negate, parseMoney, type CurrencyCode, type Money } from './money.ts';

export type TransactionDirection = 'expense' | 'income';

export type TransactionSource =
  | { readonly kind: 'bank'; readonly accountId: string; readonly accountName: LocalizedText }
  | { readonly kind: 'manual' }
  | { readonly kind: 'receipt' };

export interface FinanceTransaction {
  readonly id: string;
  readonly merchant: string;
  readonly category: SpendingCategoryId;
  /** Always positive and kept in the currency it was charged in. */
  readonly amount: Money;
  readonly direction: TransactionDirection;
  readonly date: Date;
  readonly source: TransactionSource;
  readonly hasReceipt: boolean;
  /** Reported by the bank but not booked yet. */
  readonly isPending: boolean;
}

export interface Account {
  readonly id: string;
  readonly name: LocalizedText;
  readonly kind: BankAccount['kind'];
  readonly balance: Money;
}

export function isIncome(transaction: FinanceTransaction): boolean {
  return transaction.direction === 'income';
}

export function isForeignCurrency(transaction: FinanceTransaction): boolean {
  return transaction.amount.currency !== 'GEL';
}

export function signedAmount(transaction: FinanceTransaction): Money {
  return isIncome(transaction) ? transaction.amount : negate(transaction.amount);
}

export function transactionSourceTitle(source: TransactionSource): LocalizedText {
  switch (source.kind) {
    case 'bank':
      return source.accountName;
    case 'manual':
      return lt('Added manually', 'ხელით დამატებული');
    case 'receipt':
      return lt('Imported from receipt', 'იმპორტირებული ქვითრიდან');
  }
}

/** The account day-to-day spending comes out of: the first current account, else the first card. */
export function everydayAccount(accounts: readonly Account[]): Account | null {
  return accounts.find((account) => account.kind === 'current') ?? accounts.find((account) => account.kind === 'card') ?? null;
}

/** A typed transaction amount, or null while it isn't a positive amount. */
export function parseTransactionAmount(text: string, currency: CurrencyCode): Money | null {
  const amount = parseMoney(text, currency);
  return amount && !isZero(amount) ? amount : null;
}

export interface ManualTransactionInput {
  readonly merchant: string;
  readonly category: SpendingCategoryId;
  readonly amount: Money;
  readonly direction: TransactionDirection;
  readonly date: Date;
  readonly fromReceipt?: boolean;
}

export function manualTransaction(input: ManualTransactionInput, id: string = newId()): FinanceTransaction {
  const fromReceipt = input.fromReceipt ?? false;
  return {
    id,
    merchant: input.merchant.trim(),
    category: input.category,
    amount: input.amount,
    direction: input.direction,
    date: input.date,
    source: fromReceipt ? { kind: 'receipt' } : { kind: 'manual' },
    hasReceipt: fromReceipt,
    isPending: false,
  };
}
