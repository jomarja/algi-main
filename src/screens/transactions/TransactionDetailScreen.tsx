import { useState } from 'react';
import { Button, CategoryIcon, cx, DetailRow, Divider, Icon, StatusBanner, Tag } from '../../design/index.ts';
import {
  CATEGORY_META,
  isForeignCurrency,
  isIncome,
  signedAmount,
  type FinanceTransaction,
  type SpendingCategoryId,
} from '../../engine/index.ts';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { PressableCard } from '../home/PressableCard.tsx';
import { ContentUnavailable } from './ContentUnavailable.tsx';
import { RecategorizeSheet } from './RecategorizeSheet.tsx';
import { ReceiptSheet } from './ReceiptSheet.tsx';
import { categoryAppearance, transactionSourceText } from './transactionPresentation.ts';

/** One transaction: amount (original and converted), date, category, merchant, source and receipt (TransactionDetailView). */
export default function TransactionDetailScreen({ params }: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const transaction = store.transactions.find((candidate) => candidate.id === params.transactionId);

  return (
    <ScreenLayout title={display.t('Transaction', 'ტრანზაქცია')} width="narrow">
      {transaction ? (
        <TransactionDetail transaction={transaction} />
      ) : (
        <ContentUnavailable icon="doc.questionmark" title={display.t('Transaction not found', 'ტრანზაქცია ვერ მოიძებნა')} />
      )}
    </ScreenLayout>
  );
}

function TransactionDetail({ transaction }: { transaction: FinanceTransaction }) {
  const store = useAppStore();
  const display = useDisplay();
  const [isRecategorizing, setRecategorizing] = useState(false);
  const [isShowingReceipt, setShowingReceipt] = useState(false);
  const [updatedCategory, setUpdatedCategory] = useState<SpendingCategoryId | null>(null);
  const categoryTitle = display.text(CATEGORY_META[transaction.category].title);

  const recategorize = (category: SpendingCategoryId) => {
    store.updateCategory(transaction.id, category);
    setUpdatedCategory(category);
  };

  return (
    <>
      <Summary transaction={transaction} />

      {updatedCategory && (
        <StatusBanner
          kind="success"
          title={display.t('Category updated', 'კატეგორია განახლდა')}
          message={display.t(
            `Now in ${display.text(CATEGORY_META[updatedCategory].title)}. Your insights and budgets use the new category.`,
            `ახლა „${display.text(CATEGORY_META[updatedCategory].title)}“-შია. ანალიზი და ბიუჯეტები ახალ კატეგორიას იყენებს.`,
          )}
        />
      )}

      <div className="rounded-lg border border-line bg-surface px-4 py-2">
        <DetailRow title={display.t('Date', 'თარიღი')} value={display.date(transaction.date, 'weekdayDayMonth')} />
        <Divider />
        <button
          type="button"
          onClick={() => setRecategorizing(true)}
          aria-label={display.t(`Category: ${categoryTitle}. Change category`, `კატეგორია: ${categoryTitle}. კატეგორიის შეცვლა`)}
          className="pressable-dim flex w-full items-center gap-2 text-left"
        >
          <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-2">
            <span className="type-subheadline text-inkSoft">{display.t('Category', 'კატეგორია')}</span>
            <span className="type-subheadline text-right font-semibold text-ink">{categoryTitle}</span>
          </span>
          <span aria-hidden className="text-inkMuted">
            <Icon name="chevron.right" size={12} />
          </span>
        </button>
        <Divider />
        <DetailRow title={display.t('Merchant', 'მერჩანტი')} value={transaction.merchant} />
        <Divider />
        <DetailRow title={display.t('Source', 'წყარო')} value={transactionSourceText(transaction.source, display)} />
        <Divider />
        <DetailRow title={display.t('Original currency', 'ორიგინალი ვალუტა')} value={transaction.amount.currency} />
      </div>

      <ReceiptCard transaction={transaction} onOpen={() => setShowingReceipt(true)} />

      <Button kind="secondary" icon="tag" onClick={() => setRecategorizing(true)}>
        {display.t('Change category', 'კატეგორიის შეცვლა')}
      </Button>

      <RecategorizeSheet
        isOpen={isRecategorizing}
        current={transaction.category}
        onClose={() => setRecategorizing(false)}
        onSelect={recategorize}
      />
      <ReceiptSheet isOpen={isShowingReceipt} transaction={transaction} onClose={() => setShowingReceipt(false)} />
    </>
  );
}

function Summary({ transaction }: { transaction: FinanceTransaction }) {
  const store = useAppStore();
  const display = useDisplay();
  const { converter } = store;
  const signed = signedAmount(transaction);

  return (
    <div className="flex flex-col items-center gap-3 pt-3 text-center">
      <CategoryIcon {...categoryAppearance(transaction.category)} size={64} />
      <p className="type-title2 text-ink">{transaction.merchant}</p>
      <p className={cx('type-display', isIncome(transaction) ? 'text-mintDark' : 'text-ink')}>
        {display.original(signed, { sign: 'always' })}
      </p>
      {transaction.isPending && (
        <Tag text={display.t('Pending · not booked yet', 'მოლოდინში · ჯერ არ არის გატარებული')} tone="attention" icon="clock" />
      )}
      {isForeignCurrency(transaction) && (
        <div className="flex flex-col items-center gap-1">
          <p className="type-headline text-inkSoft">≈ {display.original(converter.convert(signed, 'GEL'))}</p>
          <p className="type-footnote text-inkSoft">
            {`1 ${transaction.amount.currency} = ${display.original(converter.unitValue(transaction.amount.currency, 'GEL'))}`}
          </p>
          <Tag
            text={display.t(
              `Sample rate · ${display.date(converter.asOf, 'dayMonthYear')} · not live`,
              `სანიმუშო კურსი · ${display.date(converter.asOf, 'dayMonthYear')} · არა რეალური`,
            )}
            tone="estimate"
            icon="info.circle"
          />
        </div>
      )}
    </div>
  );
}

function ReceiptCard({ transaction, onOpen }: { transaction: FinanceTransaction; onOpen: () => void }) {
  const display = useDisplay();

  if (transaction.hasReceipt) {
    return (
      <PressableCard onClick={onOpen} className="items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-mintPale text-mintDark">
          <Icon name="doc.text.fill" size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-subheadline font-semibold text-ink">{display.t('Receipt attached', 'ქვითარი მიმაგრებულია')}</span>
          <span className="type-footnote text-inkSoft">
            {display.t('Tap to review items and total', 'შეეხე პროდუქტებისა და ჯამის სანახავად')}
          </span>
        </span>
        <span aria-hidden className="text-inkMuted">
          <Icon name="chevron.right" size={14} />
        </span>
      </PressableCard>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-cream text-inkMuted">
        <Icon name="doc.badge.plus" size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="type-subheadline font-semibold text-ink">{display.t('No receipt', 'ქვითარი არ არის')}</p>
        <p className="type-footnote text-inkSoft">
          {display.t('Receipt capture is coming soon.', 'ქვითრის დამატება მალე იქნება ხელმისაწვდომი.')}
        </p>
      </div>
    </div>
  );
}
