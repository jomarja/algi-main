import { Fragment, useEffect, useState } from 'react';
import { Card, DetailRow, Divider, Sheet, StatusBanner, ValueSlider } from '../../design/index.ts';
import type { PaletteToken } from '../../design/index.ts';
import { gel, negate, zero, type AllowanceImpact, type Money } from '../../engine/index.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { upcomingTotal } from '../plan/budget/budgetModel.ts';
import { UpcomingPaymentsCard } from '../plan/budget/UpcomingPaymentsCard.tsx';
import { everydayAccount } from './homeModel.ts';

const PURCHASE_SLIDER = { min: 0, max: 250, step: 5 } as const;

interface TodayAllowanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The working behind today's guide, a check before a purchase, and upcoming bills (TodayAllowanceSheet in TodayAllowance.swift). */
export function TodayAllowanceSheet({ isOpen, onClose }: TodayAllowanceSheetProps) {
  const store = useAppStore();
  const display = useDisplay();

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.t("Today's guide", 'დღევანდელი მითითება')}
      detent="large"
      trailingAction={{ title: display.t('Done', 'მზადაა'), onClick: onClose }}
    >
      <div className="flex flex-col gap-5 pb-6 pt-1">
        <Working />
        <PurchaseCheck isOpen={isOpen} />
        <BalanceExplanation />
        <UpcomingPaymentsCard
          payments={store.upcomingPayments}
          total={upcomingTotal(store.upcomingPayments, store.converter)}
          nextPayday={store.nextPayday}
          priorityOf={(category) => store.budget.priority(category)}
        />
      </div>
    </Sheet>
  );
}

function Working() {
  const store = useAppStore();
  const display = useDisplay();
  const allowance = store.allowance;
  const finance = store.finance;
  const whole = (value: Money) => display.money(value, { precision: 'whole' });

  const rows: ReadonlyArray<{ title: string; value: Money; tone?: PaletteToken }> = [
    { title: display.t("This week's plan", 'ამ კვირის გეგმა'), value: finance.weeklyPlanProgress.limit },
    { title: display.t('Spent since Monday', 'დახარჯული ორშაბათიდან'), value: negate(finance.weeklyPlanProgress.spent) },
    { title: display.t('Left this week', 'ამ კვირაში დარჩა'), value: allowance.weeklyRemaining },
    { title: display.t('Kept for groceries & transport', 'სურსათისა და ტრანსპორტისთვის'), value: allowance.protectedForEssentials },
    { title: display.t('Flexible left', 'მოქნილი დარჩა'), value: allowance.flexibleLeft, tone: 'mintDark' },
    {
      title: display.t(`Today, over ${finance.daysLeftInWeek} days left`, `დღეს, დარჩენილ ${finance.daysLeftInWeek} დღეზე`),
      value: allowance.today,
      tone: 'mintDark',
    },
  ];

  return (
    <Card>
      {rows.map((row, index) => (
        <Fragment key={row.title}>
          {index > 0 && <Divider />}
          <DetailRow title={row.title} value={whole(row.value)} valueTone={row.tone} />
        </Fragment>
      ))}
    </Card>
  );
}

/** "Thinking of spending?": what a purchase today would do to the week and the goal. */
function PurchaseCheck({ isOpen }: { isOpen: boolean }) {
  const store = useAppStore();
  const display = useDisplay();
  const [plannedSpend, setPlannedSpend] = useState(0);
  const amount = gel(plannedSpend);
  const formatted = display.money(amount, { precision: 'whole' });

  useEffect(() => {
    if (isOpen) setPlannedSpend(0);
  }, [isOpen]);

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="type-headline text-ink">{display.t('Thinking of spending?', 'ხარჯვას აპირებ?')}</h3>
      <p key={plannedSpend} aria-live="polite" className="type-title2 animate-page-fade text-ink">
        {formatted}
      </p>
      <ValueSlider
        value={plannedSpend}
        onChange={setPlannedSpend}
        {...PURCHASE_SLIDER}
        label={display.t('Planned spending today', 'დაგეგმილი ხარჯი დღეს')}
        valueText={formatted}
      />
      <ImpactMessage impact={store.allowance.impact(amount)} />
    </Card>
  );
}

function ImpactMessage({ impact }: { impact: AllowanceImpact }) {
  const display = useDisplay();
  const whole = (value: Money) => display.money(value, { precision: 'whole' });

  switch (impact.kind) {
    case 'withinAllowance':
      return (
        <StatusBanner
          kind="success"
          title={display.t("Fits today's guide", 'დღევანდელ მითითებაში ეტევა')}
          message={display.t('Your plan and goals stay exactly on track.', 'გეგმა და მიზნები ზუსტად თავის ადგილზე რჩება.')}
        />
      );
    case 'lowersLaterDays':
      return (
        <StatusBanner
          kind="info"
          title={display.t('Still within this week', 'ამ კვირის ფარგლებშია')}
          message={display.t(
            `The other days would have about ${whole(impact.newDaily)} each. Your goal date doesn't change.`,
            `დარჩენილ დღეებს თითოს დაახლოებით ${whole(impact.newDaily)} დარჩება. მიზნის თარიღი არ იცვლება.`,
          )}
        />
      );
    case 'delaysGoal':
      return (
        <StatusBanner
          kind="warning"
          title={display.t("Goes past this week's plan", 'ამ კვირის გეგმას სცდება')}
          message={display.t(
            `The extra ${whole(impact.overspend)} would come from savings and move your goal about ${impact.days} days later. That's okay if it matters — you can rebalance next week.`,
            `დამატებითი ${whole(impact.overspend)} დანაზოგიდან წავა და მიზანს დაახლოებით ${impact.days} დღით გადაწევს. თუ მნიშვნელოვანია, ეს ნორმალურია — შემდეგ კვირაში დააბალანსებ.`,
          )}
        />
      );
  }
}

/** Why today's guide is smaller than the everyday account's balance. */
function BalanceExplanation() {
  const store = useAppStore();
  const display = useDisplay();
  const whole = (value: Money) => display.money(value, { precision: 'whole' });
  const everyday = everydayAccount(store.accounts)?.balance ?? zero('GEL');
  const bills = upcomingTotal(store.upcomingPayments, store.converter);
  const goals = store.budget.savingsContributions;

  return (
    <StatusBanner
      kind="info"
      title={display.t('Why not your whole balance?', 'რატომ არა მთელი ბალანსი?')}
      message={display.t(
        `Your everyday account shows ${whole(everyday)}, but ${whole(bills)} is needed for bills before payday and ${whole(goals)} a month goes to your goals. Today's guide is what's truly free.`,
        `ყოველდღიურ ანგარიშზე ${whole(everyday)} ჩანს, მაგრამ ${whole(bills)} ხელფასამდე გადასახადებისთვისაა საჭირო, თვეში ${whole(goals)} კი მიზნებს ხმარდება. დღევანდელი მითითება ის თანხაა, რაც მართლა თავისუფალია.`,
      )}
    />
  );
}
