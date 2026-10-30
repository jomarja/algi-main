import { Card, DestinationView, DetailRow, Divider, Icon, Overline, ValueStepper } from '../../../design/index.ts';
import { GOAL_ICON_META, GOAL_KIND_META, goalRequestDisplayName, isZero, majorUnits, negate, targetStepSize } from '../../../engine/index.ts';
import type { GoalRequest, Money, MonthlyBudget } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { TARGET_RANGE } from './plannerModel.ts';
import type { OwnershipSummary } from './plannerModel.ts';

interface UnderstoodCardProps {
  request: GoalRequest;
  onTargetChange: (target: number) => void;
}

/** "Here's what I understood": the goal's destination, name and an adjustable target. */
export function UnderstoodCard({ request, onTargetChange }: UnderstoodCardProps) {
  const display = useDisplay();
  const target = majorUnits(request.target);
  const targetText = display.money(request.target, { precision: 'whole' });

  return (
    <Card className="flex items-center gap-4">
      <DestinationView destination={GOAL_ICON_META[GOAL_KIND_META[request.kind].icon].destination} className="h-[74px] w-[92px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Overline>{display.t("Here's what I understood", 'აი, რა გავიგე')}</Overline>
        <h2 className="type-title3 text-ink">{display.text(goalRequestDisplayName(request))}</h2>
        <ValueStepper
          value={target}
          onChange={onTargetChange}
          min={TARGET_RANGE.min}
          max={TARGET_RANGE.max}
          step={targetStepSize(target)}
          label={`${display.t('Target amount', 'სამიზნე თანხა')}, ${targetText}`}
        >
          <span aria-live="polite" className="type-headline text-ink">
            {targetText}
          </span>
        </ValueStepper>
        {!isZero(request.alreadySaved) && (
          <p className="type-caption text-mintDark">
            {display.t(
              `Already saved: ${display.money(request.alreadySaved, { precision: 'whole' })}`,
              `უკვე დაზოგილია: ${display.money(request.alreadySaved, { precision: 'whole' })}`,
            )}
          </p>
        )}
      </div>
    </Card>
  );
}

/** "Buying vs. owning": the running costs of a car on top of its price. */
export function OwnershipCard({ summary, price }: { summary: OwnershipSummary; price: Money }) {
  const display = useDisplay();
  const money = (value: Money) => display.money(value, { precision: 'whole' });
  const { costs } = summary;

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="type-headline flex items-center gap-2 text-ink">
        <Icon name="car.fill" size={17} />
        {display.t('Buying vs. owning', 'ყიდვა და ფლობა')}
      </h2>
      <div>
        <DetailRow title={display.t('Purchase price', 'ფასი')} value={money(price)} />
        <DetailRow title={display.t('Registration, once', 'რეგისტრაცია, ერთჯერადად')} value={money(costs.registrationOnce)} />
      </div>
      <Divider />
      <div>
        <DetailRow title={display.t('Insurance a month', 'დაზღვევა თვეში')} value={money(costs.insurancePerMonth)} />
        <DetailRow title={display.t('Fuel a month', 'საწვავი თვეში')} value={money(costs.fuelPerMonth)} />
        <DetailRow title={display.t('Maintenance a month', 'მომსახურება თვეში')} value={money(costs.maintenancePerMonth)} />
        <DetailRow title={display.t('Owning it, a month', 'ფლობა თვეში')} value={money(summary.monthlyTotal)} valueTone="amberDeep" />
      </div>
      <p className="type-footnote text-inkSoft">
        {display.t(
          `After you buy it, owning the car would use about ${money(summary.monthlyTotal)} of your ${money(summary.flexible)} flexible money each month, leaving ${money(summary.afterPurchase)}. Estimates.`,
          `ყიდვის შემდეგ მანქანის ფლობა თვეში დაახლოებით ${money(summary.monthlyTotal)}-ს წაიღებს შენი ${money(summary.flexible)} მოქნილი თანხიდან და დარჩება ${money(summary.afterPurchase)}. შეფასებაა.`,
        )}
      </p>
    </Card>
  );
}

/** "What Luka took into account": income, protected essentials, other goals and typical flexible spending. */
export function BasisCard({ budget }: { budget: MonthlyBudget }) {
  const display = useDisplay();
  const money = (value: Money) => display.money(value, { precision: 'whole' });

  return (
    <Card className="flex flex-col">
      <h2 className="type-headline pb-2 text-ink">{display.t('What Luka took into account', 'რა გაითვალისწინა ლუკამ')}</h2>
      <DetailRow title={display.t('Monthly income', 'თვის შემოსავალი')} value={money(budget.income)} />
      <DetailRow
        title={display.t('Essentials incl. loan · protected', 'აუცილებელი, სესხის ჩათვლით · დაცული')}
        value={money(negate(budget.essentialTotal))}
      />
      <DetailRow title={display.t('Other goals', 'სხვა მიზნები')} value={money(negate(budget.savingsContributions))} />
      <DetailRow title={display.t('Typical flexible spending', 'ტიპური მოქნილი ხარჯი')} value={money(negate(budget.flexibleTotal))} />
      <div className="py-1">
        <Divider />
      </div>
      <DetailRow title={display.t('Room left each month', 'თვეში დარჩენილი')} value={money(budget.unplannedRoom)} valueTone="mintDark" />
      <p className="type-caption flex items-center gap-1.5 pt-2 text-mintDark">
        <Icon name="lock.shield.fill" size={13} />
        {display.t('Essentials are never cut to make a goal fit.', 'მიზნის გამო აუცილებელი ხარჯები არასდროს მცირდება.')}
      </p>
    </Card>
  );
}
