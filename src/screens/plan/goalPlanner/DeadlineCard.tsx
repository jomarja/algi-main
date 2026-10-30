import { Card, StatusBanner, ValueStepper } from '../../../design/index.ts';
import { addMonths, AFFORDABILITY_META } from '../../../engine/index.ts';
import type { GoalPlanner, GoalRequest } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { DEADLINE_RANGE } from './plannerModel.ts';

interface DeadlineCardProps {
  planner: GoalPlanner;
  request: GoalRequest;
  months: number;
  now: Date;
  onMonthsChange: (months: number) => void;
}

/** An optional deadline, checked against what's realistic without touching essentials. */
export function DeadlineCard({ planner, request, months, now, onMonthsChange }: DeadlineCardProps) {
  const display = useDisplay();
  const deadline = display.date(addMonths(now, months), 'monthYear');
  const label =
    months === 0
      ? display.t('No deadline', 'ვადის გარეშე')
      : display.t(`By ${deadline} · ${months} months`, `${deadline}-მდე · ${months} თვე`);

  return (
    <Card className="flex flex-col gap-3">
      <ValueStepper
        value={months}
        onChange={onMonthsChange}
        min={DEADLINE_RANGE.min}
        max={DEADLINE_RANGE.max}
        label={`${display.t('Deadline', 'ვადა')}, ${label}`}
      >
        <span aria-live="polite" className="type-subheadline font-semibold text-ink">
          {label}
        </span>
      </ValueStepper>
      {months > 0 && <Feasibility planner={planner} request={request} months={months} />}
    </Card>
  );
}

function Feasibility({ planner, request, months }: { planner: GoalPlanner; request: GoalRequest; months: number }) {
  const display = useDisplay();
  const feasibility = planner.feasibility(request, months);

  if (feasibility.kind === 'feasible') {
    const { plan } = feasibility;
    const monthly = display.money(plan.monthlySaving, { precision: 'whole' });
    const flexibleAfter = display.money(plan.flexibleAfter, { precision: 'whole' });
    const affordability = display.text(AFFORDABILITY_META[plan.affordability].label);
    return (
      <StatusBanner
        kind={plan.affordability === 'comfortable' ? 'success' : 'warning'}
        title={display.t(`Realistic: ${monthly} a month`, `რეალისტურია: თვეში ${monthly}`)}
        message={display.t(
          `${affordability}. You'd have ${flexibleAfter} a month left for flexible spending.`,
          `${affordability}. მოქნილი ხარჯისთვის თვეში ${flexibleAfter} დაგრჩება.`,
        )}
      />
    );
  }

  const required = display.money(feasibility.requiredMonthly, { precision: 'whole' });
  const maximum = display.money(feasibility.maximumMonthly, { precision: 'whole' });
  const reachable = display.money(feasibility.reachableByDeadline, { precision: 'whole' });
  const soonest = feasibility.soonestMonths;
  return (
    <StatusBanner
      kind="warning"
      title={display.t(`Not realistic in ${months} months`, `${months} თვეში არარეალისტურია`)}
      message={display.t(
        `It needs ${required} a month, but at most ${maximum} is possible without touching essentials. Closest options: reach it in ${soonest} months, or save ${reachable} by then.`,
        `საჭიროა თვეში ${required}, მაგრამ აუცილებელი ხარჯების შეუმცირებლად მაქსიმუმ ${maximum} შეიძლება. უახლოესი ვარიანტები: მიაღწიე ${soonest} თვეში, ან ამ ვადაში დაზოგე ${reachable}.`,
      )}
    />
  );
}
