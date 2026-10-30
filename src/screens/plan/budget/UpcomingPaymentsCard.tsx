import { CategoryIcon, Card, Tag } from '../../../design/index.ts';
import { CATEGORY_META } from '../../../engine/index.ts';
import type { Money, SpendingCategoryId, SpendingPriority, UpcomingPayment } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';

interface UpcomingPaymentsCardProps {
  payments: readonly UpcomingPayment[];
  total: Money;
  nextPayday: Date | null;
  priorityOf: (category: SpendingCategoryId) => SpendingPriority;
}

/** "Due before payday": known bills from the bank history, set aside before anything else. */
export function UpcomingPaymentsCard({ payments, total, nextPayday, priorityOf }: UpcomingPaymentsCardProps) {
  const display = useDisplay();

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-headline text-ink">{display.t('Due before payday', 'ხელფასამდე გადასახდელი')}</h2>
        <span className="type-headline shrink-0 text-ink">{display.money(total, { precision: 'whole' })}</span>
      </div>
      {nextPayday && (
        <p className="type-caption text-inkSoft">
          {display.t(
            `Next payday: ${display.date(nextPayday, 'weekdayDayMonth')}`,
            `შემდეგი ხელფასი: ${display.date(nextPayday, 'weekdayDayMonth')}`,
          )}
        </p>
      )}
      {payments.length === 0 ? (
        <p className="type-footnote py-2 text-inkSoft">{display.t('Nothing due before payday.', 'ხელფასამდე გადასახდელი არაფერია.')}</p>
      ) : (
        <ul className="flex flex-col">
          {payments.map((payment) => (
            <UpcomingPaymentRow key={payment.id} payment={payment} isFlexible={priorityOf(payment.category) === 'flexible'} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function UpcomingPaymentRow({ payment, isFlexible }: { payment: UpcomingPayment; isFlexible: boolean }) {
  const display = useDisplay();
  const meta = CATEGORY_META[payment.category];

  return (
    <li className="flex items-center gap-3 py-1">
      <CategoryIcon icon={meta.icon} tint={meta.tint} background={meta.background} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-subheadline font-semibold text-ink">{display.text(payment.title)}</span>
        <span className="type-caption text-inkSoft">{display.date(payment.dueDate, 'weekdayDayMonth')}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="type-subheadline font-semibold text-ink">{display.original(payment.amount)}</span>
        {payment.isEstimate ? (
          <Tag text={display.t('Estimate', 'შეფასება')} tone="estimate" />
        ) : (
          isFlexible && <Tag text={display.t('Flexible', 'მოქნილი')} />
        )}
      </div>
    </li>
  );
}
