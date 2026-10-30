import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface FilterChipProps {
  title: string;
  icon?: string;
  isSelected?: boolean;
  onClick: () => void;
}

/** Selectable capsule used for filters and suggested prompts. */
export function FilterChip({ title, icon, isSelected = false, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={cx(
        'type-subheadline pressable-dim inline-flex min-h-[36px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 font-semibold transition-colors',
        isSelected ? 'bg-ink text-white' : 'border border-line bg-surface text-ink',
      )}
    >
      {icon && <Icon name={icon} size={15} />}
      {title}
    </button>
  );
}
