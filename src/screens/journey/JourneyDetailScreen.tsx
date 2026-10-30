import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { ContentUnavailable } from '../plan/shared/ContentUnavailable.tsx';
import { JourneyCard } from './JourneyCard.tsx';

/** One journey on its own screen (JourneyView.swift `JourneyDetailView`), e.g. from a coach suggestion or a new plan. */
export default function JourneyDetailScreen({ params }: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const goal = store.getState().goals.find((candidate) => candidate.id === params.goalId);

  return (
    <ScreenLayout title={goal ? display.text(goal.name) : display.t('Journey', 'გზა')} width="wide">
      {goal ? (
        <JourneyCard goal={goal} />
      ) : (
        <ContentUnavailable icon="target" title={display.t('Goal not found', 'მიზანი ვერ მოიძებნა')} />
      )}
    </ScreenLayout>
  );
}
