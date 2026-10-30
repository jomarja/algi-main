import { useState } from 'react';
import { Button, Card, StatusBanner, ValueSlider } from '../../design/index.ts';
import { divide, majorUnits, money, negate, subtract, WEEKS_PER_MONTH, type Money } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

const SLIDER = { min: 60, max: 300, step: 10 } as const;

interface AdjustBudgetViewProps {
  currentBudget: Money;
  onSave: (newBudget: Money) => void;
}

/** Sets next month's delivery budget with a slider (AdjustBudgetView in SpendingInterventionSheet.swift). */
export function AdjustBudgetView({ currentBudget, onSave }: AdjustBudgetViewProps) {
  const display = useDisplay();
  const [amount, setAmount] = useState(() => majorUnits(currentBudget));
  const newBudget = money(amount, currentBudget.currency);
  const formatted = display.money(newBudget, { precision: 'whole' });
  const weekly = display.money(divide(newBudget, WEEKS_PER_MONTH), { precision: 'whole' });
  const label = display.t('Monthly delivery budget', 'მიტანის თვის ბიუჯეტი');

  return (
    <div className="flex flex-col gap-5 pb-6 pt-1">
      <Card className="flex flex-col items-center gap-2 text-center">
        <span className="type-subheadline text-inkSoft">{label}</span>
        <span key={amount} aria-live="polite" className="type-display animate-page-fade text-ink">
          {formatted}
        </span>
        <span className="type-footnote text-inkSoft">{display.t(`About ${weekly} a week`, `დაახლოებით ${weekly} კვირაში`)}</span>
        <div className="w-full pt-3">
          <ValueSlider value={amount} onChange={setAmount} {...SLIDER} label={label} valueText={formatted} />
        </div>
      </Card>

      <ImpactBanner difference={subtract(currentBudget, newBudget)} />

      <Button onClick={() => onSave(newBudget)} disabled={amount === majorUnits(currentBudget)}>
        {display.t('Save budget', 'ბიუჯეტის შენახვა')}
      </Button>

      <p className="type-caption text-inkMuted">
        {display.t(
          "The new budget starts next month, so this month's numbers stay accurate.",
          'ახალი ბიუჯეტი მომავალი თვიდან ამოქმედდება, რომ ამ თვის მონაცემები ზუსტი დარჩეს.',
        )}
      </p>
    </div>
  );
}

/** What the new budget means each month: freed up, extra spending, or no change. */
function ImpactBanner({ difference }: { difference: Money }) {
  const display = useDisplay();

  if (difference.minorUnits > 0) {
    const freed = display.money(difference, { precision: 'whole' });
    return (
      <StatusBanner
        kind="success"
        title={display.t(`Frees about ${freed} a month`, `თვეში დაახლოებით ${freed} გათავისუფლდება`)}
        message={display.t('You could move it to your savings goal. Estimate.', 'შეგიძლია დანაზოგის მიზანს მოახმარო. შეფასება.')}
      />
    );
  }
  if (difference.minorUnits < 0) {
    const extra = display.money(negate(difference), { precision: 'whole' });
    return (
      <StatusBanner
        kind="warning"
        title={display.t(`Uses ${extra} more each month`, `თვეში ${extra}-ით მეტს გამოიყენებს`)}
        message={display.t(
          "That comes out of your monthly plan. That's fine if it's a conscious choice.",
          'ეს თვის გეგმიდან დაიხარჯება. თუ გაცნობიერებული არჩევანია, ყველაფერი რიგზეა.',
        )}
      />
    );
  }
  return (
    <StatusBanner
      kind="info"
      title={display.t('Same as your current budget', 'იგივეა, რაც ახლანდელი ბიუჯეტი')}
      message={display.t('Move the slider to see the impact.', 'გადაწიე სლაიდერი გავლენის სანახავად.')}
    />
  );
}
