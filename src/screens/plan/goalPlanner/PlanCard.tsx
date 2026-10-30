import { Button, Card, CategoryIcon, DetailRow, Icon, Tag } from '../../../design/index.ts';
import { AFFORDABILITY_META, CATEGORY_META, GOAL_PACE_TITLES, negate, planRisks, weeklySaving } from '../../../engine/index.ts';
import type { GoalPlan, GoalRequest, Money } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';

interface PlanCardProps {
  plan: GoalPlan;
  request: GoalRequest;
  /** Flexible money each month before the plan. */
  flexibleAllowance: Money;
  isApplied: boolean;
  onChoose: () => void;
}

/** One way to get there: amount, timing, where the money comes from, what's left, and the trade-offs. */
export function PlanCard({ plan, request, flexibleAllowance, isApplied, onChoose }: PlanCardProps) {
  const display = useDisplay();
  const money = (value: Money) => display.money(value, { precision: 'whole' });
  const affordability = AFFORDABILITY_META[plan.affordability];
  const completion = display.date(plan.completionDate, 'monthYear');

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-title3 text-ink">{display.text(GOAL_PACE_TITLES[plan.pace])}</h3>
        <Tag text={display.text(affordability.label)} tone={affordability.tone} />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="type-title text-ink">{money(plan.monthlySaving)}</span>
        <span className="type-footnote text-inkSoft">
          {display.t(
            `a month · about ${money(weeklySaving(plan))} a week`,
            `თვეში · დაახლოებით ${money(weeklySaving(plan))} კვირაში`,
          )}
        </span>
      </p>
      <p className="type-subheadline flex items-start gap-2 font-semibold text-ink">
        <span className="pt-0.5">
          <Icon name="flag.checkered" size={15} />
        </span>
        {display.t(
          `Reached around ${completion} · ${plan.months} months`,
          `მიიღწევა დაახლოებით ${completion}-ში · ${plan.months} თვე`,
        )}
      </p>

      {plan.adjustments.length === 0 ? (
        <p className="type-footnote text-mintDark">{display.t('No changes to your spending needed.', 'ხარჯების შეცვლა საჭირო არ არის.')}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="type-caption font-semibold text-inkSoft">{display.t('Where it comes from', 'საიდან')}</p>
          <ul className="flex flex-col gap-1.5">
            {plan.adjustments.map((cut) => {
              const category = CATEGORY_META[cut.category];
              return (
                <li key={cut.category} className="flex items-start gap-2">
                  <CategoryIcon icon={category.icon} tint={category.tint} background={category.background} size={24} />
                  <span className="flex min-w-0 flex-col">
                    <span className="type-footnote font-semibold text-ink">
                      {display.text(category.title)} {money(negate(cut.monthlySaving))}
                    </span>
                    <span className="type-caption text-inkSoft">{display.text(cut.lifestyleNote)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <DetailRow
        title={display.t('Left for flexible spending', 'მოქნილი ხარჯისთვის რჩება')}
        value={`${money(flexibleAllowance)} → ${money(plan.flexibleAfter)}`}
      />

      <ul className="flex flex-col gap-1">
        {planRisks(plan, request, display).map((risk) => (
          <li key={risk} className="type-caption flex items-start gap-1.5 text-inkSoft">
            <span className="pt-px">
              <Icon name="info.circle" size={12} />
            </span>
            {risk}
          </li>
        ))}
      </ul>

      <Button onClick={onChoose} disabled={isApplied}>
        {display.t('Choose this plan', 'ამ გეგმის არჩევა')}
      </Button>
    </Card>
  );
}
