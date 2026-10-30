import { useState } from 'react';
import { Card, Icon, Overline, ProgressBar, SectionHeader } from '../../design/index.ts';
import { LESSON_CONTENT, LESSONS, SAVED_VIA_RECOMMENDATIONS_ALL_TIME } from '../../engine/index.ts';
import type { Lesson } from '../../engine/index.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { AchievementTile } from './AchievementTile.tsx';
import { LessonSheet } from './LessonSheet.tsx';

/**
 * Rewards good decisions, not just spending less (RewardsSection.swift): this week, money kept by following Luka,
 * achievements, personal records and short lessons. Nothing here punishes a hard week.
 */
export function RewardsSection() {
  const display = useDisplay();

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title={display.t('Progress & rewards', 'პროგრესი და ჯილდოები')}
        overline={display.t('Celebrating good decisions', 'კარგი გადაწყვეტილებები')}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <WeeklySummary />
        <KeptByFollowingLuka />
      </div>
      <Achievements />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <Records />
        <Lessons />
      </div>
      <p className="type-footnote flex items-start gap-2 text-inkSoft">
        <span className="pt-px">
          <Icon name="arrow.uturn.forward.circle" size={15} />
        </span>
        {display.t(
          'Had a big week? Nothing resets. Make a revised plan anytime and keep going.',
          'რთული კვირა გქონდა? არაფერი ნულდება. ნებისმიერ დროს გადახედე გეგმას და გააგრძელე.',
        )}
      </p>
    </section>
  );
}

function WeeklySummary() {
  const store = useAppStore();
  const display = useDisplay();
  const progress = store.finance.weeklyPlanProgress;
  const spent = display.money(progress.spent, { precision: 'whole' });
  const limit = display.money(progress.limit, { precision: 'whole' });
  const flexibleLeft = display.money(store.allowance.flexibleLeft, { precision: 'whole' });

  return (
    <Card background="mintPale" bordered={false} className="flex flex-col gap-3">
      <Overline tone="mintDark">{display.t('This week so far', 'ეს კვირა ჯერჯერობით')}</Overline>
      <p className="type-callout font-medium text-ink">
        {display.t(
          `${spent} of ${limit} spent — groceries and transport are covered.`,
          `${limit}-დან ${spent} დახარჯულია — სურსათი და ტრანსპორტი დაფარულია.`,
        )}
      </p>
      <ProgressBar value={progress.fractionUsed} tint="mint" track="surface" label={display.t('This week so far', 'ეს კვირა ჯერჯერობით')} />
      <p className="type-footnote text-inkSoft">
        {display.t(`${flexibleLeft} still flexible until Sunday.`, `კვირამდე კიდევ ${flexibleLeft} მოქნილი თანხაა.`)}
      </p>
    </Card>
  );
}

function KeptByFollowingLuka() {
  const store = useAppStore();
  const display = useDisplay();
  const { completedRecommendations } = store.getState();
  const allTime = display.money(SAVED_VIA_RECOMMENDATIONS_ALL_TIME, { precision: 'whole' });

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-headline text-ink">{display.t('Kept by following Luka', 'ლუკას რჩევებით დაზოგილი')}</h3>
        <p className="type-title3 shrink-0 text-mintDark">{display.money(store.savedViaRecommendationsThisMonth, { precision: 'whole' })}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {completedRecommendations.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <span className="text-mint">
              <Icon name="checkmark.circle.fill" size={17} />
            </span>
            <span className="type-subheadline min-w-0 flex-1 text-ink">{display.text(item.title)}</span>
            <span className="type-subheadline shrink-0 font-semibold text-mintDark">
              {display.money(item.saved, { precision: 'whole', sign: 'always' })}
            </span>
          </li>
        ))}
      </ul>
      <p className="type-caption text-inkSoft">{display.t(`${allTime} since you started.`, `დაწყებიდან — ${allTime}.`)}</p>
    </Card>
  );
}

function Achievements() {
  const store = useAppStore();
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {store.rewards.achievements.map((achievement) => (
        <li key={achievement.id} className="flex">
          <AchievementTile achievement={achievement} />
        </li>
      ))}
    </ul>
  );
}

function Records() {
  const store = useAppStore();
  const display = useDisplay();
  const { bestSavingMonth, savingStreakMonths } = store.history;

  return (
    <div className="grid grid-cols-2 gap-3">
      {bestSavingMonth && (
        <RecordTile
          title={display.t('Best saving month', 'საუკეთესო თვე')}
          value={display.money(bestSavingMonth.total, { precision: 'whole' })}
          detail={display.date(bestSavingMonth.month, 'monthYear')}
        />
      )}
      <RecordTile
        title={display.t('Longest streak', 'ყველაზე გრძელი სერია')}
        value={display.t(`${savingStreakMonths} months`, `${savingStreakMonths} თვე`)}
        detail={display.t('and counting', 'და გრძელდება')}
      />
    </div>
  );
}

function RecordTile({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card padding="s" className="flex flex-col gap-0.5">
      <p className="type-caption flex items-center gap-1 text-amberDeep">
        <Icon name="trophy.fill" size={12} />
        {title}
      </p>
      <p className="type-title3 text-ink">{value}</p>
      <p className="type-caption text-inkSoft">{detail}</p>
    </Card>
  );
}

function Lessons() {
  const store = useAppStore();
  const display = useDisplay();
  const { completedLessons } = store.getState();
  const [lesson, setLesson] = useState<Lesson>(LESSONS[0]);
  const [isOpen, setOpen] = useState(false);

  const open = (next: Lesson) => {
    setLesson(next);
    setOpen(true);
  };

  return (
    <Card className="flex flex-col gap-2">
      <h3 className="type-headline text-ink">{display.t('Two-minute lessons', 'ორწუთიანი გაკვეთილები')}</h3>
      <ul>
        {LESSONS.map((item) => {
          const isDone = completedLessons.includes(item);
          return (
            <li key={item}>
              <button type="button" onClick={() => open(item)} className="pressable-dim flex min-h-[44px] w-full items-center gap-3 text-left">
                <span className={isDone ? 'text-mint' : 'text-amberDeep'}>
                  <Icon
                    name={isDone ? 'checkmark.circle.fill' : 'book'}
                    size={17}
                    label={isDone ? display.t('Done', 'დასრულებულია') : undefined}
                  />
                </span>
                <span className="type-subheadline flex-1 font-semibold text-ink">{display.text(LESSON_CONTENT[item].title)}</span>
                <span className="text-inkMuted">
                  <Icon name="chevron.right" size={12} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <LessonSheet lesson={lesson} isOpen={isOpen} onClose={() => setOpen(false)} onComplete={(done) => store.completeLesson(done)} />
    </Card>
  );
}
