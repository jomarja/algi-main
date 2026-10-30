import { useCallback, useState } from 'react';
import { isoDay, type FinanceTransaction } from '../../engine/index.ts';
import { useAppStore } from '../../state/AppStateProvider.tsx';
import { draftTransaction, initialDraft, isDraftComplete } from './transactionDraft.ts';
import type { EntryMode, TransactionDraft } from './transactionDraft.ts';

export interface TransactionDraftState {
  draft: TransactionDraft;
  setDraft: (draft: TransactionDraft) => void;
  /** The latest day the date field accepts, "2026-10-29". */
  today: string;
  canSave: boolean;
  /** Records the transaction; null (and nothing saved) while the draft is incomplete. */
  save: () => FinanceTransaction | null;
  /** Starts over with an empty form. Stable across renders. */
  reset: () => void;
}

/** The add-transaction form's state, shared by the Add screen and onboarding's manual-entry sheet. */
export function useTransactionDraft(mode: EntryMode): TransactionDraftState {
  const store = useAppStore();
  const [draft, setDraft] = useState(() => initialDraft(store.now));

  const save = () => {
    const transaction = draftTransaction(draft, mode, store.now);
    if (transaction) store.addTransaction(transaction);
    return transaction;
  };

  const reset = useCallback(() => setDraft(initialDraft(store.now)), [store]);

  return { draft, setDraft, today: isoDay(store.now), canSave: isDraftComplete(draft, store.now), save, reset };
}
