import { Card } from '../../../design/index.ts';
import type { LoanComparison, Money } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { ComparisonTable } from '../shared/ComparisonTable.tsx';
import { offerTotalWithSwitching, switchingBudgetEffect } from './loanModel.ts';

/** The full cost of both loans side by side, and what switching means for the monthly budget. */
export function LoanResults({ comparison }: { comparison: LoanComparison }) {
  const display = useDisplay();
  const { current, offer } = comparison;
  const offerTotal = offerTotalWithSwitching(comparison);
  if (!current || !offer || !offerTotal) return null;

  const money = (value: Money) => display.money(value, { precision: 'whole' });
  const budgetEffect = switchingBudgetEffect(comparison);

  return (
    <Card className="flex flex-col gap-3">
      <ComparisonTable
        caption={display.t('Current loan and offer', 'მიმდინარე სესხი და შეთავაზება')}
        columns={[display.t('Current', 'მიმდინარე'), display.t('Offer', 'შეთავაზება')]}
        rows={[
          { id: 'monthly', title: display.t('Monthly payment', 'თვიური გადასახადი'), values: [money(current.monthlyPayment), money(offer.monthlyPayment)] },
          { id: 'months', title: display.t('Months left', 'დარჩენილი თვეები'), values: [String(current.months), String(offer.months)] },
          { id: 'interest', title: display.t('Total interest', 'სულ პროცენტი'), values: [money(current.totalInterest), money(offer.totalInterest)] },
          { id: 'fees', title: display.t('Fees & insurance', 'საკომისიო და დაზღვევა'), values: [money(current.totalFees), money(offer.totalFees)] },
          { id: 'switch', title: display.t('Cost to switch', 'გადასვლის ხარჯი'), values: ['—', money(comparison.switchingCost)] },
          {
            id: 'total',
            title: display.t('Total to repay', 'სულ დასაბრუნებელი'),
            values: [money(current.totalRepayable), money(offerTotal)],
            isEmphasized: true,
          },
        ]}
      />
      {budgetEffect && (
        <p className="type-footnote text-inkSoft">
          {display.t(
            `Your budget: switching frees ${money(budgetEffect.freedMonthly)} a month now, but you'd keep paying for ${budgetEffect.extraMonths} more months.`,
            `შენი ბიუჯეტი: გადასვლა ახლა თვეში ${money(budgetEffect.freedMonthly)}-ს გაათავისუფლებს, მაგრამ გადახდა ${budgetEffect.extraMonths} თვით მეტხანს გაგრძელდება.`,
          )}
        </p>
      )}
    </Card>
  );
}
