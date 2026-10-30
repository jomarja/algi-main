import { CategoryIcon, Card, Icon } from '../../../design/index.ts';
import { CATEGORY_META, SPENDING_PRIORITIES, SPENDING_PRIORITY_TITLES } from '../../../engine/index.ts';
import type { BudgetLine, SpendingCategoryId, SpendingPriority } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';

interface PriorityCardProps {
  title: string;
  icon: string;
  lines: readonly BudgetLine[];
  priorityOf: (category: SpendingCategoryId) => SpendingPriority;
  onPriorityChange: (priority: SpendingPriority, category: SpendingCategoryId) => void;
}

/** One group of spending, essential or flexible; categories that are always protected can't be moved. */
export function PriorityCard({ title, icon, lines, priorityOf, onPriorityChange }: PriorityCardProps) {
  const display = useDisplay();

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="type-headline flex items-center gap-2 text-ink">
        <Icon name={icon} size={17} />
        {title}
      </h2>
      <ul className="flex flex-col">
        {lines.map((line) => {
          const meta = CATEGORY_META[line.category];
          const name = display.text(meta.title);
          const amount = display.money(line.monthlyAmount, { precision: 'whole' });
          return (
            <li key={line.category} className="flex items-center gap-3 py-1">
              <CategoryIcon icon={meta.icon} tint={meta.tint} background={meta.background} size={36} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="type-subheadline font-semibold text-ink">{name}</span>
                <span className="type-caption text-inkSoft">{display.t(`${amount} a typical month`, `ტიპურ თვეში ${amount}`)}</span>
              </div>
              {meta.isAlwaysProtected ? (
                <span className="type-caption flex shrink-0 items-center gap-1 font-semibold text-mintDark">
                  <Icon name="lock.fill" size={11} />
                  {display.t('Always protected', 'ყოველთვის დაცული')}
                </span>
              ) : (
                <PriorityPicker label={name} value={priorityOf(line.category)} onChange={(priority) => onPriorityChange(priority, line.category)} />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

interface PriorityPickerProps {
  label: string;
  value: SpendingPriority;
  onChange: (priority: SpendingPriority) => void;
}

/** The iOS menu picker as a native select: the current choice with a chevron, keyboard and screen-reader friendly. */
function PriorityPicker({ label, value, onChange }: PriorityPickerProps) {
  const display = useDisplay();
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const priority = SPENDING_PRIORITIES.find((option) => option === event.target.value);
          if (priority) onChange(priority);
        }}
        className="type-subheadline min-h-[36px] cursor-pointer appearance-none rounded-sm bg-transparent py-1 pl-2 pr-6 text-right text-ink transition-colors hover:bg-cream"
      >
        {SPENDING_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {display.text(SPENDING_PRIORITY_TITLES[priority])}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-1.5 text-inkSoft">
        <Icon name="chevron.down" size={11} />
      </span>
    </span>
  );
}
