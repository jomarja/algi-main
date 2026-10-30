import { StatusBanner } from '../../../design/index.ts';
import { negate } from '../../../engine/index.ts';
import type { WhatIfInputs, WhatIfOutcome, WhatIfSimulator } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { loanVersusSavings, planFit } from './whatIfModel.ts';

interface WhatIfVerdictProps {
  simulator: WhatIfSimulator;
  inputs: WhatIfInputs;
  current: WhatIfOutcome;
  proposed: WhatIfOutcome;
  goalName: string;
}

/** Whether the proposed plan fits the month, and the loan-or-savings trade-off of paying extra on a loan. */
export function WhatIfVerdict({ simulator, inputs, current, proposed, goalName }: WhatIfVerdictProps) {
  const display = useDisplay();
  const fit = planFit(proposed);
  const hasExtraLoanPayment = inputs.extraLoanPayment.minorUnits > 0 && simulator.loan !== null;
  if (fit === 'fits' && !hasExtraLoanPayment) return null;
  const roomLeft = display.money(proposed.roomLeft, { precision: 'whole' });
  const shortfall = display.money(negate(proposed.roomLeft), { precision: 'whole' });

  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {fit === 'doesNotFit' && (
        <StatusBanner
          kind="warning"
          title={display.t("This plan doesn't fit your month", 'ეს გეგმა თვეში არ ეტევა')}
          message={display.t(
            `It needs ${shortfall} more than you have each month after essentials. Try a smaller change.`,
            `აუცილებელი ხარჯების შემდეგ თვეში ${shortfall}-ით მეტი სჭირდება, ვიდრე გაქვს. სცადე უფრო მცირე ცვლილება.`,
          )}
        />
      )}
      {fit === 'tight' && (
        <StatusBanner
          kind="warning"
          title={display.t('Possible, but tight', 'შესაძლებელია, მაგრამ მჭიდროდ')}
          message={display.t(
            `Only ${roomLeft} a month would be left for surprises.`,
            `მოულოდნელობისთვის თვეში მხოლოდ ${roomLeft} დარჩება.`,
          )}
        />
      )}
      {hasExtraLoanPayment && (
        <LoanOrSavings simulator={simulator} inputs={inputs} current={current} proposed={proposed} goalName={goalName} />
      )}
    </div>
  );
}

function LoanOrSavings({ simulator, inputs, current, proposed, goalName }: WhatIfVerdictProps) {
  const display = useDisplay();
  const comparison = loanVersusSavings(simulator, inputs.extraLoanPayment, current, proposed);
  const extra = display.money(inputs.extraLoanPayment, { precision: 'whole' });
  const interestSaved = display.money(comparison.interestSaved, { precision: 'whole' });
  const date = (value: Date | null) => (value ? display.date(value, 'monthYear') : '—');
  const withSavings = date(comparison.goalCompletionWithSavings);
  const now = date(current.goalCompletion);

  return (
    <StatusBanner
      kind="info"
      title={display.t('Loan or savings?', 'სესხი თუ დანაზოგი?')}
      message={display.t(
        `Paying ${extra} extra saves about ${interestSaved} in interest and clears the loan ${comparison.monthsSooner} months sooner. The same amount in ${goalName} would get you there around ${withSavings} instead of ${now}. An emergency fund first usually makes surprises cheaper.`,
        `${extra}-ის დამატება პროცენტზე დაახლოებით ${interestSaved}-ს დაზოგავს და სესხს ${comparison.monthsSooner} თვით ადრე დაფარავს. იგივე თანხა „${goalName}“-ში მიზანს ${withSavings}-ში მიგაღწევინებს ${now}-ის ნაცვლად. ჯერ სარეზერვო ფონდი მოულოდნელობებს ჩვეულებრივ აიაფებს.`,
      )}
    />
  );
}
