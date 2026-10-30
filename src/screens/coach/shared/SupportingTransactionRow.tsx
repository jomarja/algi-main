import { TransactionRow } from '../../../design/index.ts';
import { CATEGORY_META, isIncome, signedAmount, type FinanceTransaction } from '../../../engine/index.ts';
import { buildPath } from '../../../layout/router/matchPath.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';

interface SupportingTransactionRowProps {
  transaction: FinanceTransaction;
  now: Date;
}

/** A transaction behind one of Luka's answers or suggestions, opening its detail (iOS TransactionRow in a NavigationLink). */
export function SupportingTransactionRow({ transaction, now }: SupportingTransactionRowProps) {
  const display = useDisplay();
  const category = CATEGORY_META[transaction.category];
  const amount = signedAmount(transaction);
  const isConverted = amount.currency !== display.currency;

  return (
    <TransactionRow
      merchant={transaction.merchant}
      detail={`${display.relativeDay(transaction.date, now)} · ${display.text(category.title)}`}
      amount={display.original(amount, { sign: 'always' })}
      convertedAmount={isConverted ? display.money(amount, { sign: 'always' }) : undefined}
      isIncome={isIncome(transaction)}
      hasReceipt={transaction.hasReceipt}
      category={category}
      to={buildPath('/transactions/:transactionId', { transactionId: transaction.id })}
    />
  );
}
