import { Card, SectionHeader, TransactionRow } from '../../design/index.ts';
import type { FinanceTransaction } from '../../engine/index.ts';
import { buildPath } from '../../layout/router/matchPath.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { transactionRowContent } from '../transactions/transactionPresentation.ts';

interface InsightTransactionsProps {
  transactions: readonly FinanceTransaction[];
  now: Date;
}

/** "Transactions behind this": the data the insight is based on, each opening its details. */
export function InsightTransactions({ transactions, now }: InsightTransactionsProps) {
  const display = useDisplay();
  if (transactions.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title={display.t('Transactions behind this', 'ტრანზაქციები, რომლებსაც ეფუძნება')} />
      <Card padding="s">
        <ul>
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <TransactionRow
                {...transactionRowContent(transaction, display, now)}
                to={buildPath('/transactions/:transactionId', { transactionId: transaction.id })}
              />
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
