import { Card, Tag } from '../../design/index.ts';
import { WhatIfSimulator } from '../../engine/index.ts';
import type { SavingsGoal, TagTone, WhatIfOutcome } from '../../engine/index.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { ContentUnavailable } from './shared/ContentUnavailable.tsx';
import { planFit } from './whatIf/whatIfModel.ts';
import type { PlanFit } from './whatIf/whatIfModel.ts';

const FIT_TONES: Record<PlanFit, TagTone> = { fits: 'positive', tight: 'attention', doesNotFit: 'attention' };

/**
 * Saved what-if scenarios next to the current plan, column by column (WhatIfView.swift `SavedPlansView`).
 * Columns scroll sideways on phones and wrap into a grid on laptops.
 */
export default function SavedPlansScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const goal = store.primaryGoal;

  return (
    <ScreenLayout title={display.t('Saved plans', 'შენახული გეგმები')} width="wide">
      {goal ? <PlanColumns goal={goal} /> : <ContentUnavailable icon="target" title={display.t('Add a goal first', 'ჯერ დაამატე მიზანი')} />}
    </ScreenLayout>
  );
}

function PlanColumns({ goal }: { goal: SavingsGoal }) {
  const store = useAppStore();
  const display = useDisplay();
  const simulator = new WhatIfSimulator(store.budget, goal, store.currentLoan, store.now);
  const hasLoan = simulator.loan !== null;

  return (
    <ul className="scrollbar-none -mx-5 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:overflow-visible md:px-0">
      <PlanColumn name={display.t('Now', 'ახლა')} outcome={simulator.outcome(simulator.baseline)} goal={goal} hasLoan={hasLoan} />
      {store.getState().savedPlans.map((plan) => (
        <PlanColumn
          key={plan.id}
          name={plan.name}
          outcome={plan.outcome}
          goal={goal}
          hasLoan={hasLoan}
          onRemove={() => store.removePlan(plan.id)}
        />
      ))}
    </ul>
  );
}

interface PlanColumnProps {
  name: string;
  outcome: WhatIfOutcome;
  goal: SavingsGoal;
  hasLoan: boolean;
  /** Saved plans can be removed; the current plan can't. */
  onRemove?: () => void;
}

function PlanColumn({ name, outcome, goal, hasLoan, onRemove }: PlanColumnProps) {
  const display = useDisplay();
  const goalName = display.text(goal.name);
  const fit = planFit(outcome);
  const fitLabels: Record<PlanFit, string> = {
    fits: display.t('Fits', 'ეტევა'),
    tight: display.t('Tight', 'მჭიდრო'),
    doesNotFit: display.t("Doesn't fit", 'არ ეტევა'),
  };
  const metrics = [
    { id: 'room', title: display.t('Room left / month', 'დარჩენილი / თვე'), value: display.money(outcome.roomLeft, { precision: 'whole' }) },
    { id: 'goal', title: display.t('To goal / month', 'მიზანზე / თვე'), value: display.money(outcome.goalMonthly, { precision: 'whole' }) },
    {
      id: 'reached',
      title: display.t(`${goalName} reached`, `„${goalName}“`),
      value: outcome.goalCompletion ? display.date(outcome.goalCompletion, 'monthYear') : '—',
    },
    ...(hasLoan
      ? [
          {
            id: 'loan',
            title: display.t('Loan paid off in', 'სესხი დაიფარება'),
            value: display.t(`${outcome.loanMonthsLeft} months`, `${outcome.loanMonthsLeft} თვე`),
          },
        ]
      : []),
  ];

  return (
    <li className="flex w-[180px] shrink-0 snap-start md:w-auto">
      <Card background={onRemove ? 'surface' : 'cream'} className="flex flex-col items-start gap-3">
        <h2 className="type-headline text-ink">{name}</h2>
        <dl className="flex flex-col gap-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="flex flex-col gap-0.5">
              <dt className="type-caption text-inkSoft">{metric.title}</dt>
              <dd className="type-subheadline font-semibold text-ink">{metric.value}</dd>
            </div>
          ))}
        </dl>
        <Tag text={fitLabels[fit]} tone={FIT_TONES[fit]} />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={display.t(`Remove ${name}`, `წაშლა: ${name}`)}
            className="type-footnote pressable-dim min-h-[44px] font-semibold text-coralDeep"
          >
            {display.t('Remove', 'წაშლა')}
          </button>
        )}
      </Card>
    </li>
  );
}
