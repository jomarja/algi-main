import { ButtonLink, Card, EmptyState, FilterChip } from '../../design/index.ts';
import { GOAL_ICON_META } from '../../engine/index.ts';
import type { SavingsGoal } from '../../engine/index.ts';
import { useRouter, useSearchParams } from '../../layout/router/Router.tsx';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { journeyTabPath } from '../goals/goalRoutes.ts';
import { GOAL_PLANNER_PATH } from '../plan/goalPlanner/plannerQuery.ts';
import { CardLink } from '../plan/shared/CardLink.tsx';
import { ChipScroller } from '../plan/shared/ChipScroller.tsx';
import { HeaderLink } from '../plan/shared/HeaderLink.tsx';
import { Intro } from '../plan/shared/Intro.tsx';
import { JourneyCard } from './JourneyCard.tsx';
import { RewardsSection } from './RewardsSection.tsx';

/**
 * "Where am I going?" (JourneyView.swift): every goal as a journey toward an illustrated destination, plus progress
 * and rewards. `?goal=<id>` picks the journey shown; it defaults to the primary goal.
 */
export default function JourneyScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const query = useSearchParams();
  const { goals } = store.getState();
  const selected = goals.find((goal) => goal.id === query.get('goal')) ?? store.primaryGoal;

  return (
    <ScreenLayout
      title={display.t('Journey', 'გზა')}
      titleDisplay="large"
      width="wide"
      trailing={<HeaderLink to={GOAL_PLANNER_PATH} icon="plus" label={display.t('New journey', 'ახალი გზა')} />}
    >
      <Intro>{display.t('Small steps. Meaningful wins.', 'პატარა ნაბიჯები. დიდი გამარჯვებები.')}</Intro>
      {selected ? (
        <>
          <GoalPicker
            goals={goals}
            selectedId={selected.id}
            onSelect={(goalId) => router.navigate(journeyTabPath(goalId), { replace: true })}
          />
          <JourneyCard key={selected.id} goal={selected} />
          <CardLink to={GOAL_PLANNER_PATH} icon="map" title={display.t('Plan a new journey', 'ახალი გზის დაგეგმვა')} />
          <RewardsSection />
        </>
      ) : (
        <Card>
          <EmptyState
            pose="savings"
            title={display.t('Start your first journey', 'დაიწყე პირველი გზა')}
            message={display.t(
              "A car, a trip, a safety cushion — tell Luka where you're going.",
              'მანქანა, მოგზაურობა, ფინანსური ბალიში — უთხარი ლუკას, სად მიდიხარ.',
            )}
          >
            <ButtonLink to={GOAL_PLANNER_PATH}>{display.t('Plan a journey', 'გზის დაგეგმვა')}</ButtonLink>
          </EmptyState>
        </Card>
      )}
    </ScreenLayout>
  );
}

interface GoalPickerProps {
  goals: readonly SavingsGoal[];
  selectedId: string;
  onSelect: (goalId: string) => void;
}

function GoalPicker({ goals, selectedId, onSelect }: GoalPickerProps) {
  const display = useDisplay();
  return (
    <ChipScroller label={display.t('Your goals', 'შენი მიზნები')}>
      {goals.map((goal) => (
        <FilterChip
          key={goal.id}
          title={display.text(goal.name)}
          icon={GOAL_ICON_META[goal.icon].symbol}
          isSelected={goal.id === selectedId}
          onClick={() => onSelect(goal.id)}
        />
      ))}
    </ChipScroller>
  );
}
