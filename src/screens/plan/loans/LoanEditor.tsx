import { Card, Tag, Toggle, ValueStepper } from '../../../design/index.ts';
import { majorUnits, money, safeAmount, safePercent } from '../../../engine/index.ts';
import type { LoanTerms, Money } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { TERM_RANGE } from './loanModel.ts';
import { NumberField } from './NumberField.tsx';

interface LoanEditorProps {
  title: string;
  terms: LoanTerms;
  onChange: (terms: LoanTerms) => void;
  /** Only the current loan has an early repayment fee, paid when switching away from it. */
  showsPenalty: boolean;
  /** Marks terms that came from the bank. */
  isFromBank?: boolean;
}

/** Every term that changes what a loan really costs, editable, with typed values kept within safe bounds. */
export function LoanEditor({ title, terms, onChange, showsPenalty, isFromBank = false }: LoanEditorProps) {
  const display = useDisplay();
  const update = (changes: Partial<LoanTerms>) => onChange({ ...terms, ...changes });
  const amount = (value: number): Money => money(value, terms.principal.currency);
  const term = display.t(`Term: ${terms.months} months`, `ვადა: ${terms.months} თვე`);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-headline text-ink">{title}</h2>
        {isFromBank && <Tag text={display.t('From your bank', 'შენი ბანკიდან')} icon="building.columns" />}
      </div>
      <NumberField
        label={display.t('Amount owed (₾)', 'დარჩენილი თანხა (₾)')}
        value={majorUnits(terms.principal)}
        onChange={(value) => update({ principal: amount(value) })}
        clamp={safeAmount}
      />
      <NumberField
        label={display.t('Annual rate (%)', 'წლიური განაკვეთი (%)')}
        value={terms.annualRatePercent}
        onChange={(annualRatePercent) => update({ annualRatePercent })}
        clamp={safePercent}
      />
      <ValueStepper value={terms.months} onChange={(months) => update({ months })} min={TERM_RANGE.min} max={TERM_RANGE.max} label={term}>
        <span aria-live="polite" className="type-subheadline text-ink">
          {term}
        </span>
      </ValueStepper>
      <Toggle label={display.t('Variable rate', 'ცვლადი განაკვეთი')} checked={terms.isVariableRate} onChange={(isVariableRate) => update({ isVariableRate })} />
      <NumberField
        label={display.t('Upfront fee (%)', 'ერთჯერადი საკომისიო (%)')}
        value={terms.upfrontFeePercent}
        onChange={(upfrontFeePercent) => update({ upfrontFeePercent })}
        clamp={safePercent}
      />
      <NumberField
        label={display.t('Monthly fee (₾)', 'თვიური საკომისიო (₾)')}
        value={majorUnits(terms.monthlyFee)}
        onChange={(value) => update({ monthlyFee: amount(value) })}
        clamp={safeAmount}
      />
      <NumberField
        label={display.t('Insurance per month (₾)', 'დაზღვევა თვეში (₾)')}
        value={majorUnits(terms.monthlyInsurance)}
        onChange={(value) => update({ monthlyInsurance: amount(value) })}
        clamp={safeAmount}
      />
      {showsPenalty && (
        <NumberField
          label={display.t('Early repayment fee (%)', 'წინსწრებით დაფარვის საკომისიო (%)')}
          value={terms.earlyRepaymentPenaltyPercent}
          onChange={(earlyRepaymentPenaltyPercent) => update({ earlyRepaymentPenaltyPercent })}
          clamp={safePercent}
        />
      )}
    </Card>
  );
}
