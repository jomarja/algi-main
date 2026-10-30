import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Card, IllustrationStage, ProgressBar, Sheet, StatusBanner, Tag } from '../../design/index.ts';
import { addDays, ILLUSTRATIVE_MONTHLY_REDUCTION, multiply, subtract, type Money } from '../../engine/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { AdjustBudgetView } from './AdjustBudgetView.tsx';
import { AlternativesView } from './AlternativesView.tsx';

type InterventionView = 'overview' | 'alternatives' | 'adjustBudget';

/** Overshooting by less than half a lari would read "around 0 ₾ over budget", so that counts as within budget. */
const MIN_SHOWN_OVERSPEND_MINOR_UNITS = 50;

interface SpendingInterventionSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Appears when the delivery budget is nearly used up (SpendingInterventionSheet.swift). Supportive by design:
 * no red alerts, no guilt, just what's been spent, what may happen, and a few easy options. The alternatives and
 * the budget editor open inside the sheet, like the iOS navigation stack.
 */
export function SpendingInterventionSheet({ isOpen, onClose }: SpendingInterventionSheetProps) {
  const store = useAppStore();
  const display = useDisplay();
  const [view, setView] = useState<InterventionView>('overview');
  const budget = store.finance.deliveryBudget;
  const upcoming = store.getState().upcomingDeliveryBudget;

  useEffect(() => {
    if (isOpen) setView('overview');
  }, [isOpen]);

  // Each view starts at its top, like a pushed screen, rather than where the previous one was scrolled to.
  const viewTop = useRef<HTMLDivElement>(null);
  const shownView = useRef(view);
  useLayoutEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    viewTop.current?.scrollIntoView({ block: 'start' });
  }, [view]);

  const saveRevisedBudget = (amount: Money) => {
    store.setUpcomingDeliveryBudget(amount);
    setView('overview');
  };

  const titles: Record<InterventionView, string> = {
    overview: display.t('Delivery budget', 'მიტანის ბიუჯეტი'),
    alternatives: display.t('Alternatives', 'ალტერნატივები'),
    adjustBudget: display.t('Adjust budget', 'ბიუჯეტის შეცვლა'),
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={titles[view]}
      detent="large"
      leadingAction={view === 'overview' ? undefined : { title: display.t('Back', 'უკან'), onClick: () => setView('overview') }}
      trailingAction={{ title: display.t('Done', 'მზადაა'), onClick: onClose }}
    >
      <div ref={viewTop} />
      {view === 'overview' && (
        <Overview onExploreAlternatives={() => setView('alternatives')} onAdjustBudget={() => setView('adjustBudget')} onClose={onClose} />
      )}
      {view === 'alternatives' && <AlternativesView currentBudget={budget.limit} onApply={saveRevisedBudget} />}
      {view === 'adjustBudget' && <AdjustBudgetView currentBudget={upcoming?.amount ?? budget.limit} onSave={saveRevisedBudget} />}
    </Sheet>
  );
}

interface OverviewProps {
  onExploreAlternatives: () => void;
  onAdjustBudget: () => void;
  onClose: () => void;
}

function Overview({ onExploreAlternatives, onAdjustBudget, onClose }: OverviewProps) {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const budget = store.finance.deliveryBudget;
  const upcoming = store.getState().upcomingDeliveryBudget;

  const askCoach = () => {
    onClose();
    store.askCoach('whySpendMore');
    router.navigate('/coach');
  };

  return (
    <div className="flex flex-col gap-5 pb-6 pt-1">
      <IllustrationStage pose="overspending" background="amberPale" height={220} className="rounded-xl" />

      <div className="flex flex-col gap-2">
        <h3 className="type-title2 text-ink">
          {budget.status === 'over'
            ? display.t('Your food delivery budget is used up', 'მიტანის ბიუჯეტი ამოიწურა')
            : display.t('Your food delivery budget is almost used up', 'მიტანის ბიუჯეტი თითქმის ამოიწურა')}
        </h3>
        <p className="type-callout text-inkSoft">
          {display.t(
            "That happens. Here's where things stand and a few easy ways to stay on track.",
            'ეს ხდება. აი, სად ვართ და რამდენიმე მარტივი გზა, რომ გეგმაში დარჩე.',
          )}
        </p>
      </div>

      {upcoming && (
        <StatusBanner
          kind="success"
          title={display.t('Revised budget saved', 'ახალი ბიუჯეტი შენახულია')}
          message={display.t(
            `${display.money(upcoming.amount, { precision: 'whole' })} a month for delivery, starting next month.`,
            `მიტანისთვის თვეში ${display.money(upcoming.amount, { precision: 'whole' })}, მომავალი თვიდან.`,
          )}
        />
      )}

      <BudgetCard />
      <ProjectionCard />
      <ScenarioCard />

      <div className="flex flex-col gap-2">
        <Button onClick={onExploreAlternatives}>{display.t('Explore alternatives', 'ალტერნატივების ნახვა')}</Button>
        <Button kind="secondary" onClick={onAdjustBudget}>
          {display.t('Adjust my budget', 'ბიუჯეტის შეცვლა')}
        </Button>
        <Button kind="tertiary" icon="bubble.left.and.text.bubble.right" onClick={askCoach}>
          {display.t('Ask AI Coach', 'ჰკითხე AI ქოუჩს')}
        </Button>
      </div>
    </div>
  );
}

function BudgetCard() {
  const store = useAppStore();
  const display = useDisplay();
  const finance = store.finance;
  const budget = finance.deliveryBudget;
  const limit = display.money(budget.limit, { precision: 'whole' });
  const daysLeft = finance.daysLeftInMonth;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="type-caption text-inkSoft">{display.t('Spent', 'დახარჯული')}</span>
          <span className="type-title2 text-ink">{display.money(budget.spent, { precision: 'whole' })}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="type-caption text-inkSoft">{display.t('Left', 'დარჩა')}</span>
          <span className="type-title2 text-mintDark">{display.money(budget.remaining, { precision: 'whole' })}</span>
        </div>
      </div>
      <ProgressBar value={budget.fractionUsed} tint="amber" height={10} label={display.t('Delivery budget used', 'გამოყენებული ბიუჯეტი')} />
      <p className="type-footnote text-inkSoft">
        {display.t(
          `of ${limit} this month · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go`,
          `${limit}-დან ამ თვეში · დარჩა ${daysLeft} დღე`,
        )}
      </p>
    </Card>
  );
}

function ProjectionCard() {
  const store = useAppStore();
  const display = useDisplay();
  const finance = store.finance;
  const projected = finance.projectedDeliverySpend;
  const difference = subtract(projected, finance.deliveryBudget.limit);
  const projectedText = display.money(projected, { precision: 'whole' });
  const differenceText = display.money(difference, { precision: 'whole' });
  const endDay = display.date(addDays(finance.currentMonth.end, -1), 'dayMonth');

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-headline text-ink">{display.t('If the recent pattern continues', 'თუ ბოლო დღეების ტემპი გაგრძელდა')}</h3>
        <Tag text={display.t('Estimate', 'შეფასება')} tone="estimate" />
      </div>
      <p className="type-subheadline text-inkSoft">
        {difference.minorUnits >= MIN_SHOWN_OVERSPEND_MINOR_UNITS
          ? display.t(
              `At your last 7 days' pace, delivery could reach about ${projectedText} by ${endDay} — around ${differenceText} over budget.`,
              `ბოლო 7 დღის ტემპით, ${endDay}-მდე მიტანაზე ხარჯი დაახლოებით ${projectedText} იქნება — ბიუჯეტზე დაახლოებით ${differenceText}-ით მეტი.`,
            )
          : display.t(
              `At your last 7 days' pace, you'd finish around ${projectedText} — still within budget.`,
              `ბოლო 7 დღის ტემპით, თვეს დაახლოებით ${projectedText}-ით დაასრულებ — ბიუჯეტის ფარგლებში.`,
            )}
      </p>
    </Card>
  );
}

function ScenarioCard() {
  const store = useAppStore();
  const display = useDisplay();
  const reduction = display.money(ILLUSTRATIVE_MONTHLY_REDUCTION, { precision: 'whole' });
  const yearly = display.money(multiply(ILLUSTRATIVE_MONTHLY_REDUCTION, 12), { precision: 'whole' });
  const goal = store.primaryGoal;
  const goalName = goal ? display.text(goal.name) : display.t('your savings', 'დანაზოგი');

  return (
    <Card background="mintPale" bordered={false} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-headline text-ink">{display.t('What a small change could do', 'რას მოგცემს პატარა ცვლილება')}</h3>
        <Tag text={display.t('Scenario', 'სცენარი')} tone="estimate" />
      </div>
      <p className="type-subheadline text-inkSoft">
        {display.t(
          `If you reduce delivery spending by ${reduction} per month, you could put an additional ${yearly} toward ${goalName} over 12 months, assuming the reduction continues.`,
          `თუ მიტანაზე ხარჯს თვეში ${reduction}-ით შეამცირებ, 12 თვეში „${goalName}“-ს დამატებით ${yearly} შეიძლება მოხმარდეს, თუ შემცირება შენარჩუნდება.`,
        )}
      </p>
    </Card>
  );
}
