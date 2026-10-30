import { StatusBanner } from '../../../design/index.ts';
import { gel, NEGLIGIBLE_LOAN_DIFFERENCE, negate, zero } from '../../../engine/index.ts';
import type { LoanComparison, Money } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';

interface LoanVerdictProps {
  comparison: LoanComparison;
  hasVariableRate: boolean;
}

/** A plain verdict on the full cost, never a judgement of the lender, plus a caveat for variable rates. */
export function LoanVerdict({ comparison, hasVariableRate }: LoanVerdictProps) {
  const display = useDisplay();
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <VerdictBanner comparison={comparison} />
      {hasVariableRate && (
        <StatusBanner
          kind="info"
          title={display.t('Variable rate', 'ცვლადი განაკვეთი')}
          message={display.t(
            "This assumes today's rate for the whole term. If it rises, the total rises too.",
            'გათვლა დღევანდელ განაკვეთს მთელ ვადაზე ითვალისწინებს. თუ გაიზრდება, ჯამიც გაიზრდება.',
          )}
        />
      )}
    </div>
  );
}

function VerdictBanner({ comparison }: { comparison: LoanComparison }) {
  const display = useDisplay();
  const money = (value: Money) => display.money(value, { precision: 'whole' });
  const difference = comparison.totalDifference ?? zero('GEL');
  const monthly = comparison.monthlyDifference ?? zero('GEL');
  const extraMonths = comparison.extraMonths ?? 0;

  switch (comparison.verdict) {
    case 'potentiallyBeneficial':
      return (
        <StatusBanner
          kind="success"
          title={display.t('Potentially beneficial', 'პოტენციურად მომგებიანი')}
          message={display.t(
            `The offer looks about ${money(negate(difference))} cheaper overall, switching costs included.`,
            `შეთავაზება ჯამში დაახლოებით ${money(negate(difference))}-ით იაფია, გადასვლის ხარჯების ჩათვლით.`,
          )}
        />
      );
    case 'similarCost': {
      const negligible = money(gel(NEGLIGIBLE_LOAN_DIFFERENCE));
      return (
        <StatusBanner
          kind="info"
          title={display.t('About the same overall', 'ჯამში დაახლოებით ერთნაირია')}
          message={display.t(
            `The totals differ by less than ${negligible}. Compare flexibility and conditions instead.`,
            `სხვაობა ${negligible}-ზე ნაკლებია. შეადარე მოქნილობა და პირობები.`,
          )}
        />
      );
    }
    case 'moreExpensiveOverall':
      return (
        <StatusBanner
          kind="warning"
          title={display.t('More expensive overall', 'ჯამში უფრო ძვირია')}
          message={display.t(
            `The offer would cost about ${money(difference)} more in total.`,
            `შეთავაზება ჯამში დაახლოებით ${money(difference)}-ით მეტი დაჯდება.`,
          )}
        />
      );
    case 'lowerPaymentLongerCommitment':
      return (
        <StatusBanner
          kind="warning"
          title={display.t('Lower payment, longer debt', 'დაბალი გადასახადი, გრძელი ვალი')}
          message={display.t(
            `You'd pay ${money(negate(monthly))} less each month, but about ${money(difference)} more in total over ${extraMonths} extra months.`,
            `თვეში ${money(negate(monthly))}-ით ნაკლებს გადაიხდი, მაგრამ ჯამში დაახლოებით ${money(difference)}-ით მეტს, ${extraMonths} დამატებით თვეში.`,
          )}
        />
      );
    case 'insufficientInformation':
      return (
        <StatusBanner
          kind="info"
          title={display.t('Not enough information to compare fairly', 'სამართლიანი შედარებისთვის ინფორმაცია არ კმარა')}
          message={display.t('Add the amount, rate, and term for both loans.', 'ორივე სესხისთვის მიუთითე თანხა, განაკვეთი და ვადა.')}
        />
      );
  }
}
