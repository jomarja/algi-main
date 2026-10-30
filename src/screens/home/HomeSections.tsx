import { forwardRef } from 'react';
import {
  BrandMark,
  Card,
  CategoryIcon,
  Divider,
  Icon,
  LukaAvatarTile,
  Overline,
  ProfileBadge,
  RecommendationCard,
  RefreshButton,
  SectionHeader,
  Tag,
} from '../../design/index.ts';
import {
  CATEGORY_META,
  dateParts,
  greetingText,
  Journey,
  LANGUAGE_INFO,
  SAMPLE_PROFILE,
  type BudgetProgress,
  type SavingsGoal,
} from '../../engine/index.ts';
import { Link } from '../../layout/router/Link.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { RECOMMENDATIONS_PATH, recommendationPath } from '../coach/recommendations/destinations.ts';
import { JourneyStrip } from '../journey/JourneyStrip.tsx';
import { FinanceTransactionRow } from '../transactions/FinanceTransactionRow.tsx';
import { PressableCard } from './PressableCard.tsx';

const RECENT_ACTIVITY_COUNT = 5;

/** Brand, language toggle, refresh (laptops) and the profile badge. Must sit inside PullToRefresh. */
export function HomeHeader() {
  const store = useAppStore();
  const display = useDisplay();
  const other = display.language === 'en' ? 'ka' : 'en';

  return (
    <header className="flex items-center gap-3 pt-2">
      {/* Laptops show the brand in the sidebar already. */}
      <span className="md:hidden">
        <BrandMark />
      </span>
      <span className="flex-1" />
      <RefreshButton />
      <button
        type="button"
        onClick={() => store.setLanguage(other)}
        aria-label={display.t('Switch to Georgian', 'ინგლისურზე გადართვა')}
        className="type-footnote pressable-dim flex min-h-9 min-w-11 items-center justify-center rounded-full border border-line px-3 font-bold text-ink"
      >
        {LANGUAGE_INFO[other].shortName}
      </button>
      <ProfileBadge initials={SAMPLE_PROFILE.initials} label={display.t('Profile and settings', 'პროფილი და პარამეტრები')} to="/settings" />
    </header>
  );
}

/**
 * Today's date, the greeting, and Luka's tile. The tile is where the money toss starts; while Luka throws, the
 * overlay draws an identical tile on top, so this one hides.
 */
export const HomeGreeting = forwardRef<HTMLDivElement, { isTossing: boolean }>(function HomeGreeting({ isTossing }, tileRef) {
  const store = useAppStore();
  const display = useDisplay();
  const now = store.now;

  return (
    <div className="flex items-center gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Overline>{display.date(now, 'weekdayDayMonth')}</Overline>
        <p className="type-title text-ink">
          {display.text(greetingText(dateParts(now).hour))}, {display.text(SAMPLE_PROFILE.firstName)}
        </p>
        <p className="type-subheadline text-inkSoft">{display.t("Here's where your money stands today.", 'აი, სად დგას შენი ფული დღეს.')}</p>
      </div>
      <LukaAvatarTile ref={tileRef} className="h-[68px] w-[68px] shrink-0" style={{ opacity: isTossing ? 0 : 1 }} />
    </div>
  );
});

/** The signature journey in miniature; it opens the Journey tab. */
export function JourneyPreview({ goal }: { goal: SavingsGoal }) {
  const store = useAppStore();
  const display = useDisplay();
  const journey = new Journey(goal, store.now);
  const percent = Math.round(journey.progress * 100);
  const remaining = display.money(journey.projection.remaining, { precision: 'whole' });

  return (
    <>
      <Overline as="h2">{display.t("Where you're going", 'სად მიდიხარ')}</Overline>
      <PressableCard tone="mintPale" to="/journey" className="flex-col gap-2">
        <span className="flex items-center justify-between gap-3">
          <span className="type-headline text-ink">{display.text(goal.name)}</span>
          <Tag text={journey.scheduleLabel(display)} tone={journey.scheduleTone} />
        </span>
        <JourneyStrip journey={journey} />
        <span className="type-footnote text-inkSoft">
          {display.t(`${percent}% of the way · ${remaining} to go`, `გავლილია ${percent}% · დარჩა ${remaining}`)}
        </span>
      </PressableCard>
    </>
  );
}

/** The single most useful suggestion right now, from the proactive coach. */
export function NextStep() {
  const store = useAppStore();
  const display = useDisplay();
  const recommendations = store.proactiveCoach(display).recommendations;
  const top = recommendations[0];
  if (!top) return null;

  return (
    <div className="flex flex-col gap-2">
      <RecommendationCard
        overline={display.t('Your next step', 'შენი შემდეგი ნაბიჯი')}
        title={top.title}
        message={top.nextStep}
        pose={top.pose}
        tone={top.tone}
        linkTitle={display.t('Why am I seeing this?', 'რატომ ვხედავ ამას?')}
        to={recommendationPath({ source: 'local', id: top.id })}
      />
      {recommendations.length > 1 && (
        <Link to={RECOMMENDATIONS_PATH} className="type-subheadline pressable-dim inline-flex min-h-[44px] items-center self-start font-semibold text-mintDark">
          {display.t(`All suggestions (${recommendations.length})`, `ყველა რჩევა (${recommendations.length})`)}
        </Link>
      )}
    </div>
  );
}

/** A gentle amber nudge when the delivery budget is close to its limit (BudgetNudgeRow in HomeCards.swift). */
export function BudgetNudgeRow({ budget, onOpen }: { budget: BudgetProgress; onOpen: () => void }) {
  const display = useDisplay();
  const meta = CATEGORY_META.foodDelivery;
  const spent = display.money(budget.spent, { precision: 'whole' });
  const limit = display.money(budget.limit, { precision: 'whole' });

  return (
    <PressableCard tone="amberPale" onClick={onOpen} className="items-center gap-3">
      <CategoryIcon icon={meta.icon} tint={meta.tint} background={meta.background} size={40} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-subheadline font-semibold text-ink">
          {budget.status === 'over'
            ? display.t('Food delivery budget is used up', 'მიტანის ბიუჯეტი ამოიწურა')
            : display.t('Food delivery budget is almost used up', 'მიტანის ბიუჯეტი თითქმის ამოიწურა')}
        </span>
        <span className="type-footnote text-inkSoft">
          {display.t(`${spent} of ${limit} · let's look at options`, `${limit}-დან ${spent} · ვნახოთ ვარიანტები`)}
        </span>
      </span>
      <span className="text-inkMuted">
        <Icon name="chevron.right" size={14} />
      </span>
    </PressableCard>
  );
}

/** The latest transactions, each opening its detail, and "See all". */
export function RecentActivity() {
  const store = useAppStore();
  const display = useDisplay();
  const recent = store.finance.recentTransactions.slice(0, RECENT_ACTIVITY_COUNT);

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader title={display.t('Recent activity', 'ბოლო აქტივობა')} actionTitle={display.t('See all', 'ყველა')} actionTo="/transactions" />
      <Card padding="s">
        {recent.map((transaction, index) => (
          <div key={transaction.id}>
            {index > 0 && <Divider inset={56} />}
            <FinanceTransactionRow transaction={transaction} now={store.now} />
          </div>
        ))}
      </Card>
    </section>
  );
}
