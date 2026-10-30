import { useState } from 'react';
import { Button, Card, ChoiceCard, DetailRow, Icon, Tag } from '../../design/index.ts';
import {
  alternativesSaving,
  DEFAULT_SELECTED_ALTERNATIVES,
  DELIVERY_ALTERNATIVES,
  multiply,
  revisedDeliveryBudget,
  type DeliveryAlternative,
  type Money,
} from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

interface AlternativesViewProps {
  currentBudget: Money;
  onApply: (revisedBudget: Money) => void;
}

/** Practical swaps with transparent, estimated monthly savings (AlternativesView in SpendingInterventionSheet.swift). */
export function AlternativesView({ currentBudget, onApply }: AlternativesViewProps) {
  const display = useDisplay();
  const [selected, setSelected] = useState<readonly number[]>(DEFAULT_SELECTED_ALTERNATIVES);
  const totalSaving = alternativesSaving(selected);
  const revisedBudget = revisedDeliveryBudget(currentBudget, selected);

  const toggle = (id: number) => {
    setSelected((current) => (current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]));
  };

  return (
    <div className="flex flex-col gap-4 pb-6 pt-1">
      <p className="type-callout text-inkSoft">
        {display.t(
          'Choose what feels doable. Savings are estimates based on your average order.',
          'აირჩიე, რაც შენთვის რეალურია. დანაზოგი შეფასებაა, საშუალო შეკვეთის მიხედვით.',
        )}
      </p>

      {DELIVERY_ALTERNATIVES.map((alternative) => (
        <ChoiceCard key={alternative.id} isSelected={selected.includes(alternative.id)} onClick={() => toggle(alternative.id)}>
          <AlternativeContent alternative={alternative} />
        </ChoiceCard>
      ))}

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="type-headline text-ink">{display.t('Your revised plan', 'შენი განახლებული გეგმა')}</h3>
          <Tag text={display.t('Estimate', 'შეფასება')} tone="estimate" />
        </div>
        <DetailRow
          title={display.t('Delivery budget from next month', 'მიტანის ბიუჯეტი მომავალი თვიდან')}
          value={display.money(revisedBudget, { precision: 'whole' })}
        />
        <DetailRow
          title={display.t('Could free up each month', 'შეიძლება გათავისუფლდეს თვეში')}
          value={display.money(totalSaving, { precision: 'whole' })}
          valueTone="mintDark"
        />
        <DetailRow
          title={display.t('Over 12 months', '12 თვეში')}
          value={display.money(multiply(totalSaving, 12), { precision: 'whole' })}
          valueTone="mintDark"
        />
      </Card>

      <Button onClick={() => onApply(revisedBudget)} disabled={selected.length === 0}>
        {display.t('Use this plan', 'ამ გეგმის გამოყენება')}
      </Button>
    </div>
  );
}

function AlternativeContent({ alternative }: { alternative: DeliveryAlternative }) {
  const display = useDisplay();
  const saving = display.money(alternative.monthlySaving, { precision: 'whole' });

  return (
    <div className="flex items-start gap-3 pr-5 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-mintPale text-mintDark">
        <Icon name={alternative.icon} size={16} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="type-subheadline font-semibold text-ink">{display.text(alternative.title)}</span>
        <span className="type-footnote text-inkSoft">{display.text(alternative.detail)}</span>
        <span className="type-footnote font-semibold text-mintDark">{display.t(`≈ ${saving} a month`, `≈ ${saving} თვეში`)}</span>
      </span>
    </div>
  );
}
