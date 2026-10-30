import { Button, SectionHeader } from '../../design/index.ts';
import type { GoalProjection, SavingsGoal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

interface GoalAdjustmentsProps {
  goal: SavingsGoal;
  projection: GoalProjection;
  /** Saves the adjusted goal and confirms what changed. */
  onApply: (goal: SavingsGoal, message: string) => void;
}

/** "Make it realistic": move the date to when the current pace gets there, or save what the date needs. */
export function GoalAdjustments({ goal, projection, onApply }: GoalAdjustmentsProps) {
  const display = useDisplay();
  const newDate = projection.completionDate(goal.monthlyContribution);
  const required = display.money(projection.requiredMonthly, { precision: 'whole' });

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={display.t('Make it realistic', 'გახადე რეალისტური')} />
      {newDate && (
        <Button
          kind="secondary"
          icon="calendar"
          onClick={() =>
            onApply(
              { ...goal, targetDate: newDate },
              display.t(
                `New target date: ${display.date(newDate, 'dayMonthYear')}.`,
                `ახალი ვადა: ${display.date(newDate, 'dayMonthYear')}.`,
              ),
            )
          }
        >
          {display.t(
            `Move the date to ${display.date(newDate, 'monthYear')}`,
            `ვადის გადატანა ${display.date(newDate, 'monthYear')}-მდე`,
          )}
        </Button>
      )}
      <Button
        kind="secondary"
        icon="arrow.up.circle"
        onClick={() =>
          onApply(
            { ...goal, monthlyContribution: projection.requiredMonthly },
            display.t(`Monthly contribution set to ${required}.`, `თვის შენატანი: ${required}.`),
          )
        }
      >
        {display.t(`Save ${required} a month instead`, `თვეში ${required} დაზოგე`)}
      </Button>
    </section>
  );
}
