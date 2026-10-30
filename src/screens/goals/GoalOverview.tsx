import { Card, DetailRow, Divider, Icon, RecommendationCard, StatusBanner, palette } from '../../design/index.ts';
import { GOAL_ICON_META, GOAL_PRIORITY_TITLES, round } from '../../engine/index.ts';
import type { GoalProjection, Money, SavingsGoal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { RingBadge } from '../plan/shared/RingBadge.tsx';
import { weeklyGap } from './goalModel.ts';

interface GoalSectionProps {
  goal: SavingsGoal;
  projection: GoalProjection;
}

/** Progress ring with the goal's symbol and percentage, then its name and timeline. */
export function GoalHeader({ goal, projection }: GoalSectionProps) {
  const display = useDisplay();
  const meta = GOAL_ICON_META[goal.icon];
  const percent = `${round(projection.progress * 100)}%`;
  const saved = display.money(goal.saved, { precision: 'whole' });
  const target = display.money(goal.target, { precision: 'whole' });
  const date = display.date(goal.targetDate, 'dayMonthYear');

  return (
    <div className="flex flex-col items-center gap-4 pt-3 text-center">
      <RingBadge value={projection.progress} tint={meta.tint} size={168} lineWidth={14} label={percent}>
        <span style={{ color: palette[meta.tint] }}>
          <Icon name={meta.symbol} size={22} />
        </span>
        <span className="type-title text-ink">{percent}</span>
      </RingBadge>
      <h2 className="type-title2 text-ink">{display.text(goal.name)}</h2>
      <p className="type-subheadline text-inkSoft">
        {display.t(`${saved} of ${target} · by ${date}`, `${target}-დან ${saved} · ${date}-მდე`)}
      </p>
    </div>
  );
}

/** Where the goal stands at the current pace, with estimates labelled as such. */
export function GoalStatusBanner({ goal, projection }: GoalSectionProps) {
  const display = useDisplay();
  const projected = display.money(projection.projectedSaved(goal.monthlyContribution), { precision: 'whole' });
  const dueDate = display.date(goal.targetDate, 'dayMonthYear');
  const completionDate = projection.completionDate(goal.monthlyContribution);
  const completion = completionDate ? display.date(completionDate, 'monthYear') : '—';

  switch (projection.status) {
    case 'reached':
      return (
        <StatusBanner
          kind="success"
          title={display.t('Goal reached', 'მიზანი მიღწეულია')}
          message={display.t('Time to celebrate — or set the next one.', 'დროა იზეიმო — ან შემდეგი მიზანი დაისახო.')}
        />
      );
    case 'onTrack':
      return (
        <StatusBanner
          kind="success"
          title={display.t('On track', 'გეგმის მიხედვით')}
          message={display.t(
            `At your current pace you'd reach it around ${completion}. Estimate.`,
            `ახლანდელი ტემპით მიზანს დაახლოებით ${completion}-ში მიაღწევ. შეფასება.`,
          )}
        />
      );
    case 'slightlyBehind':
      return (
        <StatusBanner
          kind="warning"
          title={display.t('A little behind', 'ოდნავ ჩამორჩება')}
          message={display.t(
            `At your current pace you'd have about ${projected} by ${dueDate}. Estimate.`,
            `ახლანდელი ტემპით ${dueDate}-მდე დაახლოებით ${projected} გექნება. შეფასება.`,
          )}
        />
      );
    case 'unlikely':
      return (
        <StatusBanner
          kind="warning"
          title={display.t(`Unlikely by ${dueDate} at this pace`, `ამ ტემპით ${dueDate}-მდე ნაკლებად სავარაუდოა`)}
          message={display.t(
            `You'd have about ${projected}. A new date or a bigger contribution would make it realistic.`,
            `დაახლოებით ${projected} გექნება. ახალი თარიღი ან მეტი შენატანი მიზანს რეალისტურს გახდის.`,
          )}
        />
      );
  }
}

/** What's left and what it takes, per week and per month. */
export function GoalFacts({ goal, projection }: GoalSectionProps) {
  const display = useDisplay();
  const money = (value: Money) => display.money(value, { precision: 'whole' });
  const rows = [
    { id: 'remaining', title: display.t('Remaining', 'დარჩენილი'), value: money(projection.remaining) },
    { id: 'weekly', title: display.t('Needed per week', 'საჭიროა კვირაში'), value: money(projection.requiredWeekly) },
    { id: 'monthly', title: display.t('Needed per month', 'საჭიროა თვეში'), value: money(projection.requiredMonthly) },
    { id: 'contribution', title: display.t('Your monthly contribution', 'შენი თვის შენატანი'), value: money(goal.monthlyContribution) },
    { id: 'priority', title: display.t('Priority', 'პრიორიტეტი'), value: display.text(GOAL_PRIORITY_TITLES[goal.priority]) },
  ];

  return (
    <Card>
      {rows.map((row, index) => (
        <div key={row.id}>
          {index > 0 && <Divider />}
          <DetailRow title={row.title} value={row.value} />
        </div>
      ))}
    </Card>
  );
}

/** Luka's next achievable step: the weekly top-up that gets the goal back on schedule, or keep going. */
export function GoalNextStep({ goal, projection }: GoalSectionProps) {
  const display = useDisplay();
  const gap = weeklyGap(goal, projection);
  const isBehind = gap.minorUnits > 0;
  const gapText = display.money(gap, { precision: 'whole' });
  const contribution = display.money(goal.monthlyContribution, { precision: 'whole' });

  return (
    <RecommendationCard
      overline={display.t('Your next achievable step', 'შენი შემდეგი შესაძლებელი ნაბიჯი')}
      title={
        isBehind
          ? display.t(`Add ${gapText} a week on top of your usual amount.`, `ჩვეულ თანხას კვირაში ${gapText} დაამატე.`)
          : display.t(`Keep your ${contribution} monthly contribution going.`, `გააგრძელე თვეში ${contribution}-ის შენატანი.`)
      }
      message={
        isBehind
          ? display.t(
              'Your weekly plan has room for it if delivery stays near your usual level.',
              'კვირის გეგმაში ამის ადგილი იქნება, თუ მიტანის ხარჯი ჩვეულ დონეზე დარჩება.',
            )
          : display.t("You're on pace. Anything extra simply gets you there sooner.", 'ტემპი კარგია. ყოველი დამატებითი თანხა მიზანს აახლოებს.')
      }
      pose="savings"
      tone="positive"
    />
  );
}
