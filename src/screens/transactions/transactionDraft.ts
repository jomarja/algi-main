import {
  dateParts,
  isoDay,
  lt,
  manualTransaction,
  parseIsoDay,
  parseTransactionAmount,
  startOfDay,
  tbilisiDate,
  type CurrencyCode,
  type FinanceTransaction,
  type LocalizedText,
  type Money,
  type SpendingCategoryId,
  type TransactionDirection,
} from '../../engine/index.ts';

/** Manual entry, or the receipt variant used until scanning exists (AddTransactionSheet.Mode). */
export type EntryMode = 'manual' | 'receipt';

export const ENTRY_MODE_TITLES: Readonly<Record<EntryMode, LocalizedText>> = {
  manual: lt('Add transaction', 'ტრანზაქციის დამატება'),
  receipt: lt('Import receipt', 'ქვითრის იმპორტი'),
};

export function entryModeFromSearch(params: URLSearchParams): EntryMode {
  return params.get('mode') === 'receipt' ? 'receipt' : 'manual';
}

/** The add-transaction form's fields as typed. */
export interface TransactionDraft {
  readonly direction: TransactionDirection;
  readonly merchant: string;
  readonly amountText: string;
  readonly currency: CurrencyCode;
  readonly category: SpendingCategoryId;
  /** "2026-10-29", as a date input reports it. */
  readonly day: string;
}

function defaultCategory(direction: TransactionDirection): SpendingCategoryId {
  return direction === 'income' ? 'income' : 'groceries';
}

export function initialDraft(now: Date): TransactionDraft {
  return { direction: 'expense', merchant: '', amountText: '', currency: 'GEL', category: defaultCategory('expense'), day: isoDay(now) };
}

/** Switching between expense and income picks that side's usual category, as iOS does. */
export function withDirection(draft: TransactionDraft, direction: TransactionDirection): TransactionDraft {
  return { ...draft, direction, category: defaultCategory(direction) };
}

export function draftAmount(draft: TransactionDraft): Money | null {
  return parseTransactionAmount(draft.amountText, draft.currency);
}

/** Something was typed in the amount field, but it isn't a positive amount. */
export function hasAmountProblem(draft: TransactionDraft): boolean {
  return draft.amountText.trim() !== '' && draftAmount(draft) === null;
}

/**
 * When a transaction entered for `day` happened: now for today, so it lists above the day's bank items, and noon
 * (like the iOS sample dates) for an earlier day. Null for an invalid or future day.
 */
export function transactionDate(day: string, now: Date): Date | null {
  const start = parseIsoDay(day);
  if (!start || start.getTime() > startOfDay(now).getTime()) return null;
  if (day === isoDay(now)) return now;
  const { year, month, day: dayOfMonth } = dateParts(start);
  return tbilisiDate(year, month, dayOfMonth);
}

/** Whether Save can be pressed: a merchant, a positive amount and a day up to today. */
export function isDraftComplete(draft: TransactionDraft, now: Date): boolean {
  return draft.merchant.trim() !== '' && draftAmount(draft) !== null && transactionDate(draft.day, now) !== null;
}

/** The transaction to save, or null while the merchant, amount or date isn't valid. */
export function draftTransaction(draft: TransactionDraft, mode: EntryMode, now: Date, id?: string): FinanceTransaction | null {
  const amount = draftAmount(draft);
  const date = transactionDate(draft.day, now);
  if (!amount || !date || draft.merchant.trim() === '') return null;
  return manualTransaction(
    { merchant: draft.merchant, category: draft.category, amount, direction: draft.direction, date, fromReceipt: mode === 'receipt' },
    id,
  );
}
