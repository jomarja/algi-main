import { useEffect, useState } from 'react';
import { HeaderButton } from '../../design/index.ts';
import {
  filterTransactions,
  groupTransactionsByDay,
  type DayGroup,
  type TransactionFilter,
} from '../../engine/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { FinanceTransactionRow } from './FinanceTransactionRow.tsx';
import { ContentUnavailable } from './ContentUnavailable.tsx';
import { SearchField } from './SearchField.tsx';
import { DEFAULT_TRANSACTION_FILTER } from './transactionFilter.ts';
import { TransactionFilters } from './TransactionFilters.tsx';
import { dayNetTotal } from './transactionPresentation.ts';

/**
 * The filters last used, so coming Back from a transaction shows the same list, as the iOS list stays alive under
 * the detail screen. Opening the list afresh starts from the defaults.
 */
let rememberedFilter: TransactionFilter = DEFAULT_TRANSACTION_FILTER;

/** Every transaction, searchable and filterable, grouped by day with each day's total (TransactionsView). */
export default function TransactionsScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const [filter, setFilter] = useState(() => (router.action === 'pop' ? rememberedFilter : DEFAULT_TRANSACTION_FILTER));
  const transactions = filterTransactions(store.finance, filter);
  const groups = groupTransactionsByDay(transactions);
  const update = (changes: Partial<TransactionFilter>) => setFilter((current) => ({ ...current, ...changes }));

  useEffect(() => {
    rememberedFilter = filter;
  }, [filter]);

  return (
    <ScreenLayout
      title={display.t('Transactions', 'ტრანზაქციები')}
      titleDisplay="large"
      trailing={
        <HeaderButton icon="plus" label={display.t('Add transaction', 'ტრანზაქციის დამატება')} onClick={() => router.navigate('/transactions/new')} />
      }
    >
      <div className="flex flex-col gap-3">
        <SearchField
          value={filter.query}
          onChange={(query) => update({ query })}
          placeholder={display.t('Search merchants or categories', 'მოძებნე მერჩანტი ან კატეგორია')}
        />
        <TransactionFilters filter={filter} onChange={update} />
      </div>

      <p aria-live="polite" className="sr-only">
        {display.t(
          transactions.length === 1 ? '1 transaction' : `${transactions.length} transactions`,
          `${transactions.length} ტრანზაქცია`,
        )}
      </p>

      {groups.length === 0 ? (
        <ContentUnavailable
          icon="magnifyingglass"
          title={display.t('No transactions found', 'ტრანზაქციები ვერ მოიძებნა')}
          message={display.t('Try another search or clear the filters.', 'სცადე სხვა ძიება ან გაასუფთავე ფილტრები.')}
        />
      ) : (
        groups.map((group) => <DaySection key={group.day.getTime()} group={group} now={store.now} />)
      )}
    </ScreenLayout>
  );
}

function DaySection({ group, now }: { group: DayGroup; now: Date }) {
  const store = useAppStore();
  const display = useDisplay();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-footnote flex items-baseline justify-between gap-3 px-4 font-semibold text-inkSoft">
        <span>{display.relativeDay(group.day, now)}</span>
        <span>{display.money(dayNetTotal(group.transactions, store.converter), { sign: 'always' })}</span>
      </h2>
      <ul className="list-rows overflow-hidden rounded-sm bg-surface">
        {group.transactions.map((transaction) => (
          <li key={transaction.id} className="relative px-4">
            <FinanceTransactionRow transaction={transaction} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
