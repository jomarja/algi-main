import { Sheet } from '../../design/index.ts';
import type { FinanceTransaction } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { receiptLines } from './transactionPresentation.ts';

interface ReceiptSheetProps {
  isOpen: boolean;
  transaction: FinanceTransaction;
  onClose: () => void;
}

/** A rendered sample receipt; the line items are illustrative splits of the real total (ReceiptSheet). */
export function ReceiptSheet({ isOpen, transaction, onClose }: ReceiptSheetProps) {
  const display = useDisplay();
  const { date, amount } = transaction;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.t('Receipt', 'ქვითარი')}
      trailingAction={{ title: display.t('Done', 'მზადაა'), onClick: onClose }}
    >
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex w-full flex-col gap-3 bg-surface p-5 font-mono text-ink shadow-[0_4px_24px_rgba(22,60,53,0.08)]">
          <p className="text-center text-[20px] font-bold leading-[25px]">{transaction.merchant.toLocaleUpperCase()}</p>
          <p className="text-center text-[13px] leading-[18px]">
            {`${display.date(date, 'dayMonthYear')} · ${display.date(date, 'time')}`}
          </p>
          <hr aria-hidden className="border-0 border-t border-dashed border-line" />
          <dl className="flex flex-col gap-3 text-[15px] leading-[20px]">
            {receiptLines(amount).map((line, index) => (
              <div key={index} className="flex justify-between gap-3">
                <dt>{display.t(`Item group ${index + 1}`, `პროდუქტების ჯგუფი ${index + 1}`)}</dt>
                <dd>{display.original(line)}</dd>
              </div>
            ))}
          </dl>
          <hr aria-hidden className="border-0 border-t border-dashed border-line" />
          <div className="flex justify-between gap-3 text-[17px] font-bold leading-[22px]">
            <span>{display.t('Total', 'ჯამი')}</span>
            <span>{display.original(amount)}</span>
          </div>
        </div>
        <p className="type-caption text-inkMuted">{display.t('Sample receipt for the prototype.', 'პროტოტიპის სანიმუშო ქვითარი.')}</p>
      </div>
    </Sheet>
  );
}
