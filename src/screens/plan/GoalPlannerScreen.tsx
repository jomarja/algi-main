import { useState } from 'react';
import type { ReactNode } from 'react';
import { ButtonLink, SectionHeader, StatusBanner } from '../../design/index.ts';
import { gel, GoalPlanner, GoalRequestParser, majorUnits } from '../../engine/index.ts';
import type { GoalPlan, GoalRequest } from '../../engine/index.ts';
import { useRouter, useSearchParams } from '../../layout/router/Router.tsx';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import type { AppStore } from '../../state/appStore.ts';
import { journeyDetailPath } from '../goals/goalRoutes.ts';
import { CustomPlanCard } from './goalPlanner/CustomPlanCard.tsx';
import { DeadlineCard } from './goalPlanner/DeadlineCard.tsx';
import { GoalComposer } from './goalPlanner/GoalComposer.tsx';
import { PlanCard } from './goalPlanner/PlanCard.tsx';
import { ownershipSummary } from './goalPlanner/plannerModel.ts';
import { plannerRequestFromQuery } from './goalPlanner/plannerQuery.ts';
import { BasisCard, OwnershipCard, UnderstoodCard } from './goalPlanner/RequestCards.tsx';
import { SplitColumns } from './shared/SplitColumns.tsx';

/**
 * Goal-to-plan (GoalPlannerView.swift): describe a goal in your own words and get three honest ways to reach it.
 * Essentials are protected; unrealistic deadlines get the closest realistic alternatives instead.
 * `?goal=<id>` re-plans an existing goal; `?target=…&kind=…&months=…&name=…` prefills a new one.
 */
export default function GoalPlannerScreen() {
  const { location } = useRouter();
  // A new prefill (same screen, different query) starts a fresh planner.
  return <GoalPlannerContent key={location.search} />;
}

/** Plans for a request against the budget, as if the goal being re-planned didn't take its contribution yet. */
function plannerFor(store: AppStore, request: GoalRequest | null): GoalPlanner {
  return new GoalPlanner(store.budgetExcludingGoal(request?.goalId ?? null), store.now);
}

function GoalPlannerContent() {
  const store = useAppStore();
  const display = useDisplay();
  const query = useSearchParams();
  const [prefill] = useState(() => plannerRequestFromQuery(query, store.getState().goals, store.now));
  const [text, setText] = useState('');
  const [request, setRequest] = useState<GoalRequest | null>(prefill);
  const [deadlineMonths, setDeadlineMonths] = useState(prefill?.months ?? 0);
  const [customMonthly, setCustomMonthly] = useState(() => (prefill ? majorUnits(plannerFor(store, prefill).balancedMonthly) : 0));
  const [hasParseFailed, setParseFailed] = useState(false);
  const [appliedGoalId, setAppliedGoalId] = useState<string | null>(null);
  const planner = plannerFor(store, request);

  const load = (next: GoalRequest) => {
    setRequest(next);
    setDeadlineMonths(next.months ?? 0);
    setCustomMonthly(majorUnits(plannerFor(store, next).balancedMonthly));
  };

  const understand = (sentence: string) => {
    const parsed = GoalRequestParser.parse(sentence);
    setParseFailed(parsed === null);
    if (!parsed) return;
    setAppliedGoalId(null);
    load(parsed);
  };

  const apply = (plan: GoalPlan, planned: GoalRequest) => {
    setAppliedGoalId(store.applyPlan(plan, planned, planner.amountToSave(planned)));
  };

  const composer = prefill?.goalId ? null : (
    <GoalComposer text={text} onTextChange={setText} onSubmit={understand} hasParseFailed={hasParseFailed} />
  );

  return (
    <ScreenLayout title={prefill?.name ? display.text(prefill.name) : display.t('Plan a goal', 'მიზნის დაგეგმვა')} width="wide">
      {request ? (
        <PlannedGoal
          composer={composer}
          planner={planner}
          request={request}
          now={store.now}
          deadlineMonths={deadlineMonths}
          customMonthly={customMonthly}
          appliedGoalId={appliedGoalId}
          onTargetChange={(target) => setRequest({ ...request, target: gel(target) })}
          onDeadlineChange={setDeadlineMonths}
          onCustomMonthlyChange={setCustomMonthly}
          onApply={(plan) => apply(plan, request)}
        />
      ) : (
        composer
      )}
    </ScreenLayout>
  );
}

interface PlannedGoalProps {
  /** The sentence input, shown above the plan unless an existing goal is being re-planned. */
  composer: ReactNode;
  planner: GoalPlanner;
  request: GoalRequest;
  now: Date;
  deadlineMonths: number;
  customMonthly: number;
  appliedGoalId: string | null;
  onTargetChange: (target: number) => void;
  onDeadlineChange: (months: number) => void;
  onCustomMonthlyChange: (monthly: number) => void;
  onApply: (plan: GoalPlan) => void;
}

/** Inputs and assumptions on one side, the three plans and a custom amount on the other (stacked on phones). */
function PlannedGoal({
  composer,
  planner,
  request,
  now,
  deadlineMonths,
  customMonthly,
  appliedGoalId,
  onTargetChange,
  onDeadlineChange,
  onCustomMonthlyChange,
  onApply,
}: PlannedGoalProps) {
  const display = useDisplay();
  const ownership = ownershipSummary(request, planner.budget);
  const customPlan = planner.customPlan(request, gel(customMonthly));

  return (
    <SplitColumns
      leading={
        <>
          {composer}
          <UnderstoodCard request={request} onTargetChange={onTargetChange} />
          {ownership && <OwnershipCard summary={ownership} price={request.target} />}
          <BasisCard budget={planner.budget} />
          <DeadlineCard planner={planner} request={request} months={deadlineMonths} now={now} onMonthsChange={onDeadlineChange} />
        </>
      }
      trailing={
        <>
          <section className="flex flex-col gap-3">
            <SectionHeader title={display.t('Three ways to get there', 'მიღწევის სამი გზა')} />
            {planner.plans(request).map((plan) => (
              <PlanCard
                key={plan.pace}
                plan={plan}
                request={request}
                flexibleAllowance={planner.budget.flexibleAllowance}
                isApplied={appliedGoalId !== null}
                onChoose={() => onApply(plan)}
              />
            ))}
            {appliedGoalId && (
              <div className="flex animate-page-fade flex-col gap-3">
                <StatusBanner
                  kind="success"
                  title={display.t('Journey updated', 'გზა განახლდა')}
                  message={display.t(
                    'Your plan is saved. Luka will track it on your journey map.',
                    'გეგმა შენახულია. ლუკა მას გზის რუკაზე გააკონტროლებს.',
                  )}
                />
                <ButtonLink kind="secondary" to={journeyDetailPath(appliedGoalId)}>
                  {display.t('Open the journey', 'გზის გახსნა')}
                </ButtonLink>
              </div>
            )}
          </section>
          <CustomPlanCard
            planner={planner}
            plan={customPlan}
            monthly={customMonthly}
            onMonthlyChange={onCustomMonthlyChange}
            onUse={() => onApply(customPlan)}
          />
          <p className="type-caption text-inkMuted">
            {display.t(
              "Plans are estimates that assume your income and typical spending stay the same. They're not guarantees.",
              'გეგმები შეფასებაა და ითვალისწინებს, რომ შემოსავალი და ტიპური ხარჯი არ შეიცვლება. ეს გარანტია არ არის.',
            )}
          </p>
        </>
      }
    />
  );
}
