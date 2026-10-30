import { useState } from 'react';
import { Button, HeaderButton, StatusBanner } from '../../design/index.ts';
import { celebratedMilestone, GoalProjection } from '../../engine/index.ts';
import type { Money, SavingsGoal } from '../../engine/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { ContentUnavailable } from '../plan/shared/ContentUnavailable.tsx';
import { SplitColumns } from '../plan/shared/SplitColumns.tsx';
import { AddMoneySheet } from './AddMoneySheet.tsx';
import { EditGoalSheet } from './EditGoalSheet.tsx';
import { GoalAdjustments } from './GoalAdjustments.tsx';
import { milestoneCelebration, needsNewPace } from './goalModel.ts';
import { GoalFacts, GoalHeader, GoalNextStep, GoalStatusBanner } from './GoalOverview.tsx';
import { GoalProjectionSection } from './GoalProjectionSection.tsx';
import { MilestoneCelebration } from './MilestoneCelebration.tsx';
import { useCelebration } from './useCelebration.ts';

/** A goal in depth (GoalDetailView.swift): progress, what's needed, transparent projections, and adjustments. */
export default function GoalDetailScreen({ params }: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const goal = store.getState().goals.find((candidate) => candidate.id === params.goalId);

  if (!goal) {
    return (
      <ScreenLayout title={display.t('Goal', 'მიზანი')}>
        <ContentUnavailable icon="target" title={display.t('Goal not found', 'მიზანი ვერ მოიძებნა')} />
      </ScreenLayout>
    );
  }
  return <GoalDetail goal={goal} />;
}

function GoalDetail({ goal }: { goal: SavingsGoal }) {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const projection = new GoalProjection(goal, store.now);
  const [isAddingMoney, setAddingMoney] = useState(false);
  const [isEditing, setEditing] = useState(false);
  // A new editor per opening, so the form starts from the goal as it is now.
  const [editSession, setEditSession] = useState(0);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);
  const { celebration, celebrate, dismiss } = useCelebration();

  const addMoney = (amount: Money) => {
    const before = projection.progress;
    store.contribute(amount, goal.id);
    const updated = store.getState().goals.find((candidate) => candidate.id === goal.id);
    if (!updated) return;
    const share = celebratedMilestone(before, new GoalProjection(updated, store.now).progress);
    if (share !== null) celebrate(milestoneCelebration(share, updated, display));
  };

  const applyAdjustment = (adjusted: SavingsGoal, message: string) => {
    store.updateGoal(adjusted);
    setAdjustmentMessage(message);
  };

  const openEditor = () => {
    setEditSession((session) => session + 1);
    setEditing(true);
  };

  const save = (edited: SavingsGoal) => {
    store.updateGoal(edited);
    setEditing(false);
  };

  const remove = () => {
    router.navigate('/journey', { replace: true });
    store.removeGoal(goal.id);
  };

  return (
    <ScreenLayout
      title={display.text(goal.name)}
      width="wide"
      trailing={<HeaderButton title={display.t('Edit', 'რედაქტირება')} onClick={openEditor} />}
    >
      <SplitColumns
        leading={
          <>
            <GoalHeader goal={goal} projection={projection} />
            {adjustmentMessage && (
              <StatusBanner
                kind="success"
                title={display.t('Plan updated', 'გეგმა განახლდა')}
                message={adjustmentMessage}
                className="animate-page-fade"
              />
            )}
            <GoalStatusBanner goal={goal} projection={projection} />
            <GoalFacts goal={goal} projection={projection} />
            <GoalNextStep goal={goal} projection={projection} />
          </>
        }
        trailing={
          <>
            <GoalProjectionSection goal={goal} projection={projection} />
            {needsNewPace(projection.status) && <GoalAdjustments goal={goal} projection={projection} onApply={applyAdjustment} />}
            <Button icon="plus.circle.fill" onClick={() => setAddingMoney(true)}>
              {display.t('Add money', 'თანხის დამატება')}
            </Button>
          </>
        }
      />
      <AddMoneySheet goal={goal} isOpen={isAddingMoney} onClose={() => setAddingMoney(false)} onAdd={addMoney} />
      <EditGoalSheet
        key={editSession}
        goal={goal}
        isOpen={isEditing}
        now={store.now}
        onClose={() => setEditing(false)}
        onSave={save}
        onRemove={remove}
      />
      <MilestoneCelebration celebration={celebration} onClose={dismiss} />
    </ScreenLayout>
  );
}
