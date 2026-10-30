import { Card, Overline, ValueSlider } from '../../../design/index.ts';
import { gel, majorUnits } from '../../../engine/index.ts';
import type { Money, WhatIfInputs } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { ASSUMPTION_RANGES, formatPercentChange } from './whatIfModel.ts';

type MoneyAssumption = 'deliveryCut' | 'goalContribution' | 'extraLoanPayment';

interface AssumptionSlidersProps {
  inputs: WhatIfInputs;
  goalName: string;
  hasLoan: boolean;
  onChange: (inputs: WhatIfInputs) => void;
}

/** "Your assumptions": the what-if inputs, kept apart from the user's own data. */
export function AssumptionSliders({ inputs, goalName, hasLoan, onChange }: AssumptionSlidersProps) {
  const display = useDisplay();
  const money = (value: Money) => display.money(value, { precision: 'whole' });
  const moneySlider = (key: MoneyAssumption, title: string) => (
    <AssumptionSlider
      title={title}
      valueText={money(inputs[key])}
      value={majorUnits(inputs[key])}
      range={ASSUMPTION_RANGES[key]}
      onChange={(value) => onChange({ ...inputs, [key]: gel(value) })}
    />
  );

  return (
    <Card className="flex flex-col gap-4">
      <Overline tone="lavender">{display.t('Your assumptions', 'შენი დაშვებები')}</Overline>
      {moneySlider('deliveryCut', display.t('Less on food delivery each month', 'მიტანაზე ნაკლები თვეში'))}
      {moneySlider('goalContribution', display.t(`To ${goalName} each month`, `„${goalName}“-სთვის თვეში`))}
      <AssumptionSlider
        title={display.t('Income change', 'შემოსავლის ცვლილება')}
        valueText={formatPercentChange(inputs.incomeChangePercent)}
        value={inputs.incomeChangePercent}
        range={ASSUMPTION_RANGES.incomeChangePercent}
        onChange={(incomeChangePercent) => onChange({ ...inputs, incomeChangePercent })}
      />
      {hasLoan && moneySlider('extraLoanPayment', display.t('Extra loan payment each month', 'სესხზე დამატებით თვეში'))}
    </Card>
  );
}

interface AssumptionSliderProps {
  title: string;
  valueText: string;
  value: number;
  range: { readonly min: number; readonly max: number; readonly step: number };
  onChange: (value: number) => void;
}

function AssumptionSlider({ title, valueText, value, range, onChange }: AssumptionSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-subheadline text-ink">{title}</span>
        <span aria-hidden className="type-subheadline shrink-0 font-bold tabular-nums text-ink">
          {valueText}
        </span>
      </div>
      <ValueSlider
        value={value}
        onChange={onChange}
        min={range.min}
        max={range.max}
        step={range.step}
        tint="lavender"
        label={title}
        valueText={valueText}
      />
    </div>
  );
}
