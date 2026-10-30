import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface ChoiceCardProps {
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

/** Selectable card for onboarding choices and plan selection, with a tick in the top-right corner. */
export function ChoiceCard({ isSelected, onClick, children, className }: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={cx(
        'pressable relative w-full rounded-lg p-4 pr-10 text-left transition-colors',
        isSelected ? 'bg-mintPale ring-2 ring-inset ring-mint' : 'bg-surface ring-1 ring-inset ring-line',
        className,
      )}
    >
      {children}
      <span aria-hidden className={cx('absolute right-3 top-3', isSelected ? 'text-mint' : 'text-line')}>
        <Icon name={isSelected ? 'checkmark.circle.fill' : 'circle'} size={20} />
      </span>
    </button>
  );
}
