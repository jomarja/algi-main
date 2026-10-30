import type { ReactNode } from 'react';
import { FilterChip, Icon } from '../../design/index.ts';
import { CATEGORY_META, SPENDING_CATEGORIES, type TransactionFilter } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { MenuSelect } from './MenuSelect.tsx';
import { TRANSACTION_PERIOD_TITLES, TRANSACTION_PERIODS, TRANSACTION_TYPE_TITLES, TRANSACTION_TYPES } from './transactionFilter.ts';

interface TransactionFiltersProps {
  filter: TransactionFilter;
  onChange: (changes: Partial<TransactionFilter>) => void;
}

/** Type chips and the period menu, then a row of category chips; each row scrolls sideways on phones. */
export function TransactionFilters({ filter, onChange }: TransactionFiltersProps) {
  const display = useDisplay();
  return (
    <div className="flex flex-col gap-2">
      <ChipRow label={display.t('Type and period', 'ტიპი და პერიოდი')}>
        {TRANSACTION_TYPES.map((type) => (
          <FilterChip
            key={type}
            title={display.text(TRANSACTION_TYPE_TITLES[type])}
            isSelected={filter.type === type}
            onClick={() => onChange({ type })}
          />
        ))}
        <MenuSelect
          value={filter.period}
          options={TRANSACTION_PERIODS}
          onChange={(period) => onChange({ period })}
          title={(period) => display.text(TRANSACTION_PERIOD_TITLES[period])}
          label={display.t('Period', 'პერიოდი')}
          className="type-subheadline inline-flex min-h-[36px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-3 font-semibold text-ink"
        >
          <Icon name="calendar" size={15} />
          {display.text(TRANSACTION_PERIOD_TITLES[filter.period])}
          <Icon name="chevron.down" size={11} />
        </MenuSelect>
      </ChipRow>

      <ChipRow label={display.t('Category', 'კატეგორია')}>
        <FilterChip
          title={display.t('All categories', 'ყველა კატეგორია')}
          isSelected={filter.category === null}
          onClick={() => onChange({ category: null })}
        />
        {SPENDING_CATEGORIES.map((category) => (
          <FilterChip
            key={category}
            title={display.text(CATEGORY_META[category].title)}
            icon={CATEGORY_META[category].icon}
            isSelected={filter.category === category}
            onClick={() => onChange({ category: filter.category === category ? null : category })}
          />
        ))}
      </ChipRow>
    </div>
  );
}

/** Phones: a sideways-scrolling row bleeding to the screen edges, so chips aren't cut off at the margin. Laptops: wraps. */
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 py-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      {children}
    </div>
  );
}
