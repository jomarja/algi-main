import { useId, useState } from 'react';
import { Button, ButtonLink, Card, Icon, MascotAvatar, Overline, Tag } from '../../design/index.ts';
import { checkpointCelebration, Journey, MILESTONE_COUNT, replanningRequest } from '../../engine/index.ts';
import type { Money, SavingsGoal } from '../../engine/index.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { AddMoneySheet } from '../goals/AddMoneySheet.tsx';
import { needsNewPace } from '../goals/goalModel.ts';
import { goalDetailPath } from '../goals/goalRoutes.ts';
import { MilestoneCelebration } from '../goals/MilestoneCelebration.tsx';
import { useCelebration } from '../goals/useCelebration.ts';
import { goalPlannerPath } from '../plan/goalPlanner/plannerQuery.ts';
import { JourneyMap } from './JourneyMap.tsx';

/**
 * One journey (JourneyView.swift `JourneyCard`): the map, where you stand, and the next action. Celebrates each
 * checkpoint reached. From the wide breakpoint the map sits beside the details and stays in view.
 */
export function JourneyCard({ goal }: { goal: SavingsGoal }) {
  const store = useAppStore();
  const display = useDisplay();
  const titleId = useId();
  const [isAddingMoney, setAddingMoney] = useState(false);
  const { celebration, celebrate, dismiss } = useCelebration();
  const journey = new Journey(goal, store.now);

  const addMoney = (amount: Money) => {
    store.contribute(amount, goal.id);
    const updated = store.getState().goals.find((candidate) => candidate.id === goal.id);
    if (updated) celebrate(checkpointCelebration(journey, new Journey(updated, store.now), display));
  };

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-4">
      <JourneyHeader journey={journey} titleId={titleId} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <div className="xl:sticky xl:top-[calc(var(--safe-top)+68px)]">
          <JourneyMap journey={journey} />
        </div>
        <div className="flex flex-col gap-4">
          <JourneyStats journey={journey} />
          <NextCheckpoint journey={journey} />
          <NextStepCard journey={journey} onAddMoney={() => setAddingMoney(true)} />
        </div>
      </div>
      <AddMoneySheet goal={goal} isOpen={isAddingMoney} onClose={() => setAddingMoney(false)} onAdd={addMoney} />
      <MilestoneCelebration celebration={celebration} onClose={dismiss} />
    </article>
  );
}

function JourneyHeader({ journey, titleId }: { journey: Journey; titleId: string }) {
  const display = useDisplay();
  const { goal } = journey;
  const target = display.money(goal.target, { precision: 'whole' });
  const date = display.date(goal.targetDate, 'dayMonthYear');

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={titleId} className="type-title2 text-ink">
          {display.text(goal.name)}
        </h2>
        <p className="type-footnote text-inkSoft">{display.t(`${target} by ${date}`, `${target} · ${date}-მდე`)}</p>
      </div>
      <Tag text={journey.scheduleLabel(display)} tone={journey.scheduleTone} icon="location.fill" />
    </div>
  );
}

function JourneyStats({ journey }: { journey: Journey }) {
  const display = useDisplay();
  const stats = [
    { id: 'saved', title: display.t('Saved', 'დაზოგილი'), value: display.money(journey.goal.saved, { precision: 'whole' }) },
    { id: 'toGo', title: display.t('To go', 'დარჩა'), value: display.money(journey.projection.remaining, { precision: 'whole' }) },
    { id: 'checkpoints', title: display.t('Checkpoints', 'წერტილები'), value: `${journey.reachedCount}/${MILESTONE_COUNT}` },
  ];

  return (
    <dl className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <Card key={stat.id} padding="s" className="flex min-w-0 flex-col gap-0.5">
          <dt className="type-caption truncate text-inkSoft">{stat.title}</dt>
          <dd className="type-headline truncate text-ink">{stat.value}</dd>
        </Card>
      ))}
    </dl>
  );
}

function NextCheckpoint({ journey }: { journey: Journey }) {
  const display = useDisplay();
  const next = journey.nextMilestone;
  if (!next) return null;
  const amount = display.money(next.amount, { precision: 'whole' });
  const toGo = display.money(journey.amountToNextMilestone, { precision: 'whole' });

  return (
    <p className="type-footnote flex items-start gap-2 font-semibold text-ink">
      <span className="pt-px text-amber">
        <Icon name="star.fill" size={15} />
      </span>
      {display.t(`Next checkpoint: ${amount} — ${toGo} to go`, `შემდეგი წერტილი: ${amount} — დარჩა ${toGo}`)}
    </p>
  );
}

function NextStepCard({ journey, onAddMoney }: { journey: Journey; onAddMoney: () => void }) {
  const store = useAppStore();
  const display = useDisplay();
  const { goal } = journey;

  return (
    <Card background="amberPale" bordered={false} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <MascotAvatar size={40} decorative />
        <div className="flex min-w-0 flex-col gap-1">
          <Overline tone="ink">{display.t('Your next step', 'შენი შემდეგი ნაბიჯი')}</Overline>
          <p className="type-callout font-medium text-ink">{journey.nextActionMessage(display)}</p>
        </div>
      </div>
      <Button icon="plus.circle.fill" onClick={onAddMoney}>
        {display.t('Add money', 'თანხის დამატება')}
      </Button>
      {needsNewPace(journey.projection.status) && (
        <ButtonLink kind="secondary" icon="point.3.connected.trianglepath.dotted" to={goalPlannerPath(replanningRequest(goal, store.now))}>
          {display.t('See 3 ways to catch up', 'ნახე დაწევის 3 გზა')}
        </ButtonLink>
      )}
      <ButtonLink kind="tertiary" icon="chart.line.uptrend.xyaxis" to={goalDetailPath(goal.id)} className="self-start">
        {display.t('Projection & details', 'პროგნოზი და დეტალები')}
      </ButtonLink>
    </Card>
  );
}
