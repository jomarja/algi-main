import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  MoneyTossOverlay,
  Overline,
  PullToRefresh,
  Skeleton,
  SkeletonCard,
  StatusBanner,
} from '../../design/index.ts';
import type { StatusKind } from '../../design/index.ts';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { DashboardColumns, ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { SpendingInterventionSheet } from '../intervention/SpendingInterventionSheet.tsx';
import { bankSourceCopy } from '../onboarding/bankSource.ts';
import { ConnectBankSheet } from '../onboarding/ConnectBankSheet.tsx';
import { BalanceCard } from './BalanceCard.tsx';
import { BudgetNudgeRow, HomeGreeting, HomeHeader, JourneyPreview, NextStep, RecentActivity } from './HomeSections.tsx';
import { balanceIncrease, SYNC_NOTE_DURATION_MS } from './homeModel.ts';
import { TodayAllowanceCard } from './TodayAllowanceCard.tsx';
import { TodayAllowanceSheet } from './TodayAllowanceSheet.tsx';
import { useMoneyToss, type MoneyToss } from './useMoneyToss.ts';

type HomeSheet = 'today' | 'intervention' | 'connectBank';

interface SyncNote {
  kind: StatusKind;
  title: string;
  message?: string;
}

/**
 * The command centre (HomeView.swift). Answers three questions in order: where am I now, where am I going, and
 * what should I do next. Pulling down (or Refresh on laptops) re-reads TBC Bank; when that raises the balance,
 * Luka throws the difference into it.
 */
export default function HomeScreen(_props: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const [sheet, setSheet] = useState<HomeSheet | null>(null);
  const [syncNote, setSyncNote] = useState<SyncNote | null>(null);
  const tile = useRef<HTMLDivElement>(null);
  const balanceFigure = useRef<HTMLParagraphElement>(null);
  const moneyToss = useMoneyToss();
  const { toss } = moneyToss;

  useEffect(() => {
    if (syncNote?.kind !== 'success') return;
    const timer = window.setTimeout(() => setSyncNote(null), SYNC_NOTE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [syncNote]);

  const refresh = async () => {
    if (!store.isBankConnected) return;
    const before = store.finance.totalBalance;
    setSyncNote(null);
    moneyToss.hold(before);
    const added = await store.refreshBank();

    if (store.getState().bank.sync === 'error') {
      moneyToss.release();
      setSyncNote({
        kind: 'error',
        title: display.t("Couldn't refresh from TBC Bank", 'TBC ბანკიდან განახლება ვერ მოხერხდა'),
        message: display.t('Showing your last synced data. Try again in a moment.', 'ნაჩვენებია ბოლოს განახლებული მონაცემები. სცადე ცოტა ხანში.'),
      });
      return;
    }
    const increase = balanceIncrease(before, store.finance.totalBalance);
    if (increase) {
      moneyToss.throwIn(display.money(increase, { sign: 'always' }));
      return;
    }
    moneyToss.release();
    if (added.length === 0) setSyncNote({ kind: 'success', title: display.t("You're all caught up", 'ყველაფერი განახლებულია') });
  };

  return (
    <ScreenLayout title={display.t('Home', 'მთავარი')} titleDisplay="hidden" width="wide">
      <PullToRefresh onRefresh={refresh}>
        <div className="flex flex-col gap-5">
          <HomeHeader />
          <HomeGreeting ref={tile} isTossing={toss?.isFlying ?? false} />
          {syncNote && <StatusBanner kind={syncNote.kind} title={syncNote.title} message={syncNote.message} className="animate-page-fade" />}
          <HomeContent moneyToss={moneyToss} balanceFigure={balanceFigure} onOpen={setSheet} />
        </div>
      </PullToRefresh>

      {toss?.isFlying && (
        <MoneyTossOverlay
          key={toss.id}
          origin={tile}
          target={balanceFigure}
          amountText={toss.amountText}
          onLanded={moneyToss.land}
          onFinished={moneyToss.finish}
        />
      )}
      <TodayAllowanceSheet isOpen={sheet === 'today'} onClose={() => setSheet(null)} />
      <SpendingInterventionSheet isOpen={sheet === 'intervention'} onClose={() => setSheet(null)} />
      <ConnectBankSheet isOpen={sheet === 'connectBank'} onClose={() => setSheet(null)} />
    </ScreenLayout>
  );
}

interface HomeContentProps {
  moneyToss: MoneyToss;
  balanceFigure: RefObject<HTMLParagraphElement>;
  onOpen: (sheet: HomeSheet) => void;
}

/** The dashboard once there are numbers; skeletons while TBC data loads; otherwise a way to add the first ones. */
function HomeContent({ moneyToss, balanceFigure, onOpen }: HomeContentProps) {
  const store = useAppStore();
  const display = useDisplay();
  const { bank, permissions } = store.getState();

  if (!store.hasFinancialData) {
    const isLoading = bank.status === null || (store.isBankConnected && bank.sync === 'loading');
    return isLoading ? <DashboardSkeleton /> : <HomeEmptyState onConnect={() => onOpen('connectBank')} />;
  }

  const finance = store.finance;
  const goal = store.primaryGoal;
  const showsNudge = permissions.personalizedNudges && finance.deliveryBudget.status !== 'comfortable';

  return (
    <DashboardColumns
      main={
        <>
          <Overline as="h2">{display.t('Where you are', 'სად ხარ')}</Overline>
          <BalanceCard balance={moneyToss.shownBalance(finance.totalBalance)} balanceRef={balanceFigure} />
          <TodayAllowanceCard onOpen={() => onOpen('today')} />
          {goal && <JourneyPreview goal={goal} />}
        </>
      }
      aside={
        <>
          <Overline as="h2">{display.t('What to do next', 'რა გააკეთო შემდეგ')}</Overline>
          <NextStep />
          {showsNudge && <BudgetNudgeRow budget={finance.deliveryBudget} onOpen={() => onOpen('intervention')} />}
          <RecentActivity />
        </>
      }
    />
  );
}

function DashboardSkeleton() {
  const display = useDisplay();
  return (
    <div role="status" aria-label={display.t('Loading…', 'იტვირთება…')} className="flex flex-col gap-5">
      <Skeleton className="h-[260px] w-full rounded-xl" />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

function HomeEmptyState({ onConnect }: { onConnect: () => void }) {
  const store = useAppStore();
  const display = useDisplay();
  const sourceCopy = bankSourceCopy(store.getState().bank.status?.source);

  return (
    <Card>
      <EmptyState
        title={display.t("Let's add your first numbers", 'დავამატოთ პირველი მონაცემები')}
        message={display.t(
          "Connect TBC Bank or add a transaction. Luka starts coaching as soon as there's something to look at.",
          'დააკავშირე TBC ბანკი ან დაამატე ტრანზაქცია. ლუკა რჩევებს მაშინვე დაიწყებს, როგორც კი რამე გამოჩნდება.',
        )}
      >
        <Button icon="building.columns" onClick={onConnect}>
          {display.t('Connect TBC Bank', 'TBC ბანკის დაკავშირება')}
        </Button>
        <ButtonLink kind="secondary" to="/transactions/new">
          {display.t('Add a transaction', 'ტრანზაქციის დამატება')}
        </ButtonLink>
        {sourceCopy && <p className="type-caption text-center text-inkMuted">{display.text(sourceCopy.note)}</p>}
      </EmptyState>
    </Card>
  );
}
