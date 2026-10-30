import { Fragment } from 'react';
import { Card, Divider, Sheet } from '../../../design/index.ts';
import type { FinanceTransaction } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { SupportingTransactionRow } from '../shared/SupportingTransactionRow.tsx';

interface SupportingTransactionsSheetProps {
  isOpen: boolean;
  transactions: readonly FinanceTransaction[];
  now: Date;
  onClose(): void;
}

/** The transactions behind one of Luka's answers; each opens its detail (SupportingTransactionsSheet). */
export function SupportingTransactionsSheet({ isOpen, transactions, now, onClose }: SupportingTransactionsSheetProps) {
  const display = useDisplay();
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.t('Supporting transactions', 'დამხმარე ტრანზაქციები')}
      trailingAction={{ title: display.t('Done', 'მზადაა'), onClick: onClose }}
      detent="large"
      presentation="panel"
    >
      <Card padding="s">
        {transactions.map((transaction, index) => (
          <Fragment key={transaction.id}>
            {index > 0 && <Divider inset={56} />}
            <SupportingTransactionRow transaction={transaction} now={now} />
          </Fragment>
        ))}
      </Card>
    </Sheet>
  );
}
