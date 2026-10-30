import { Button, Card, StatusBanner, ValueSlider } from '../../../design/index.ts';
import { AFFORDABILITY_META, gel } from '../../../engine/index.ts';
import type { GoalPlan, GoalPlanner } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { CUSTOM_MONTHLY_MIN, CUSTOM_MONTHLY_STEP, customMonthlyMax } from './plannerModel.ts';

interface CustomPlanCardProps {
  planner: GoalPlanner;
  plan: GoalPlan;
  /** The chosen monthly amount in lari. */
  monthly: number;
  onMonthlyChange: (monthly: number) => void;
  onUse: () => void;
}

/** "Or choose your own monthly amount": a slider, with an honest stop where essentials would be touched. */
export function CustomPlanCard({ planner, plan, monthly, onMonthlyChange, onUse }: CustomPlanCardProps) {
  const display = useDisplay();
  const amount = display.money(gel(monthly), { precision: 'whole' });
  const maximum = display.money(planner.maximumMonthly, { precision: 'whole' });
  const completion = display.date(plan.completionDate, 'monthYear');
  const affordability = display.text(AFFORDABILITY_META[plan.affordability].label);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="type-headline text-ink">{display.t('Or choose your own monthly amount', 'ან აირჩიე საკუთარი თვიური თანხა')}</h2>
      <p aria-hidden className="type-title text-ink">
        {amount}
      </p>
      <ValueSlider
        value={monthly}
        onChange={onMonthlyChange}
        min={CUSTOM_MONTHLY_MIN}
        max={customMonthlyMax(planner)}
        step={CUSTOM_MONTHLY_STEP}
        label={display.t('Monthly amount', 'თვიური თანხა')}
        valueText={amount}
      />
      {plan.affordability === 'notAffordable' ? (
        <StatusBanner
          kind="warning"
          title={display.t('More than your budget allows', 'ბიუჯეტზე მეტია')}
          message={display.t(
            `Above ${maximum} a month you'd have to cut essentials. Luka won't plan that.`,
            `თვეში ${maximum}-ზე მეტისთვის აუცილებელი ხარჯების შემცირება მოგიწევდა. ლუკა ასეთ გეგმას არ შეადგენს.`,
          )}
        />
      ) : (
        <>
          <p className="type-footnote text-inkSoft">
            {display.t(
              `Reached around ${completion} (${plan.months} months) · ${affordability}`,
              `მიიღწევა დაახლოებით ${completion}-ში (${plan.months} თვე) · ${affordability}`,
            )}
          </p>
          <Button kind="secondary" onClick={onUse}>
            {display.t('Use this amount', 'ამ თანხის გამოყენება')}
          </Button>
        </>
      )}
    </Card>
  );
}
