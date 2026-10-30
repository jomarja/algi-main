import { Button } from '../../design/index.ts';
import type { SpendingCategoryId } from '../../engine/index.ts';
import { DashboardColumns, ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { upcomingTotal } from './budget/budgetModel.ts';
import { BudgetSplitCard } from './budget/BudgetSplitCard.tsx';
import { PriorityCard } from './budget/PriorityCard.tsx';
import { UpcomingPaymentsCard } from './budget/UpcomingPaymentsCard.tsx';
import { Intro } from './shared/Intro.tsx';

/**
 * Essential spending protection (BudgetPrioritiesView.swift): what's protected, what's flexible, and what's due
 * before payday. Luka covers essentials and known bills first, then looks for room in flexible spending only.
 */
export default function BudgetPrioritiesScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const budget = store.budget;
  const priorityOf = (category: SpendingCategoryId) => budget.priority(category);
  const { hasReviewedBudget } = store.getState();
  const payments = store.upcomingPayments;

  return (
    <ScreenLayout title={display.t('Essentials & flexible', 'აუცილებელი და მოქნილი')} width="wide">
      <Intro>
        {display.t(
          'Luka protects essentials first, sets aside known bills, and only then looks for room in flexible spending.',
          'ლუკა ჯერ აუცილებელ ხარჯებს იცავს, გადასახადებს გვერდზე დებს და მხოლოდ შემდეგ ეძებს ადგილს მოქნილ ხარჯებში.',
        )}
      </Intro>
      <DashboardColumns
        main={
          <>
            <BudgetSplitCard budget={budget} />
            <PriorityCard
              title={display.t('Essential · protected', 'აუცილებელი · დაცული')}
              icon="lock.shield.fill"
              lines={budget.essentialLines}
              priorityOf={priorityOf}
              onPriorityChange={(priority, category) => store.setPriority(priority, category)}
            />
            <PriorityCard
              title={display.t('Flexible', 'მოქნილი')}
              icon="slider.horizontal.3"
              lines={budget.flexibleLines}
              priorityOf={priorityOf}
              onPriorityChange={(priority, category) => store.setPriority(priority, category)}
            />
            <Button onClick={() => store.markBudgetReviewed()} disabled={hasReviewedBudget}>
              {hasReviewedBudget ? display.t('Saved', 'შენახულია') : display.t('These look right', 'ყველაფერი სწორია')}
            </Button>
          </>
        }
        aside={
          <UpcomingPaymentsCard
            payments={payments}
            total={upcomingTotal(payments, store.converter)}
            nextPayday={store.nextPayday}
            priorityOf={priorityOf}
          />
        }
      />
    </ScreenLayout>
  );
}
