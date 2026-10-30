import { Card, palette } from '../../../design/index.ts';
import type { MonthlyBudget } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { budgetSplit } from './budgetModel.ts';
import type { BudgetPart } from './budgetModel.ts';

/** "Your 3,400 ₾ month": a stacked bar of where income goes, with a legend of the amounts. */
export function BudgetSplitCard({ budget }: { budget: MonthlyBudget }) {
  const display = useDisplay();
  const slices = budgetSplit(budget);
  const titles: Record<BudgetPart, string> = {
    essentials: display.t('Essentials', 'აუცილებელი'),
    goals: display.t('Goals', 'მიზნები'),
    flexible: display.t('Flexible spending', 'მოქნილი ხარჯი'),
    room: display.t('Room left', 'დარჩენილი'),
  };
  const income = display.money(budget.income, { precision: 'whole' });

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="type-headline text-ink">{display.t(`Your ${income} month`, `შენი ${income}-იანი თვე`)}</h2>
      <div aria-hidden className="flex h-3.5 gap-0.5 overflow-hidden rounded-full">
        {slices.map((slice) => (
          <span
            key={slice.part}
            className="h-full shrink-0 transition-[width] duration-500 ease-out"
            style={{ width: `max(calc(${slice.share * 100}% - 2px), 0px)`, backgroundColor: palette[slice.tint] }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {slices.map((slice) => (
          <li key={slice.part} className="type-footnote flex items-center gap-2 text-ink">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[slice.tint] }} />
            <span className="flex-1">{titles[slice.part]}</span>
            <span className="font-semibold">{display.money(slice.amount, { precision: 'whole' })}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
