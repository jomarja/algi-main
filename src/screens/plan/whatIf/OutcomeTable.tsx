import { Card } from '../../../design/index.ts';
import type { Money, WhatIfOutcome } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { ComparisonTable } from '../shared/ComparisonTable.tsx';
import type { ComparisonRow } from '../shared/ComparisonTable.tsx';

interface OutcomeTableProps {
  current: WhatIfOutcome;
  proposed: WhatIfOutcome;
  goalName: string;
  hasLoan: boolean;
}

/** The current plan and the proposed one, figure by figure; changed figures stand out. */
export function OutcomeTable({ current, proposed, goalName, hasLoan }: OutcomeTableProps) {
  const display = useDisplay();
  const money = (value: Money) => display.money(value, { precision: 'whole' });
  const date = (value: Date | null) => (value ? display.date(value, 'monthYear') : '—');
  const months = (count: number) => display.t(`${count} months`, `${count} თვე`);
  const row = (id: string, title: string, values: readonly [string, string]): ComparisonRow => ({ id, title, values });

  const rows: ComparisonRow[] = [
    row('room', display.t('Room left each month', 'თვეში დარჩენილი'), [money(current.roomLeft), money(proposed.roomLeft)]),
    row('goalMonthly', display.t(`To ${goalName} / month`, `„${goalName}“ / თვე`), [money(current.goalMonthly), money(proposed.goalMonthly)]),
    row('goalReached', display.t(`${goalName} reached`, `„${goalName}“ მიიღწევა`), [date(current.goalCompletion), date(proposed.goalCompletion)]),
    row('saved', display.t('Saved in 12 months', '12 თვეში დაზოგილი'), [money(current.savedInTwelveMonths), money(proposed.savedInTwelveMonths)]),
    ...(hasLoan
      ? [
          row('loanMonths', display.t('Loan paid off in', 'სესხი დაიფარება'), [months(current.loanMonthsLeft), months(proposed.loanMonthsLeft)]),
          row('loanInterest', display.t('Interest left on loan', 'სესხზე დარჩენილი პროცენტი'), [
            money(current.loanInterestLeft),
            money(proposed.loanInterestLeft),
          ]),
        ]
      : []),
  ];

  return (
    <Card>
      <ComparisonTable
        caption={display.t('Now and proposed plan', 'ახლანდელი და ახალი გეგმა')}
        columns={[display.t('Now', 'ახლა'), display.t('Proposed', 'ახალი')]}
        rows={rows}
        highlightsSecond
      />
    </Card>
  );
}
