import { TransactionRow } from '../../design/index.ts';
import type { FinanceTransaction } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { transactionRowContent } from './transactionPresentation.ts';

export function transactionPath(transactionId: string): string {
  return `/transactions/${encodeURIComponent(transactionId)}`;
}

/** A transaction row that opens the transaction's detail screen. */
export function FinanceTransactionRow({ transaction, now }: { transaction: FinanceTransaction; now: Date }) {
  const display = useDisplay();
  return <TransactionRow {...transactionRowContent(transaction, display, now)} to={transactionPath(transaction.id)} />;
}
