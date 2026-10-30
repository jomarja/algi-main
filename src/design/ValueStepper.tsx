import type { KeyboardEvent, ReactNode } from 'react';
import { ValueAdjustment } from '../engine/valueAdjustment.ts';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface ValueStepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Shown to the left of the buttons, usually the name and the formatted value. */
  children: ReactNode;
  /** Accessible name of the control, e.g. "Monthly contribution, 150 ₾". */
  label: string;
}

/** A "label  −  +" control. Arrow up/down also adjust it while focus is inside. */
export function ValueStepper({ value, onChange, min, max, step = 1, children, label }: ValueStepperProps) {
  const display = useDisplay();
  const adjust = (delta: number) => {
    const next = ValueAdjustment.snapped(value + delta, { lower: min, upper: max }, step);
    if (next !== value) onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') adjust(step);
    else if (event.key === 'ArrowDown') adjust(-step);
    else return;
    event.preventDefault();
  };

  return (
    <div role="group" aria-label={label} onKeyDown={handleKeyDown} className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <StepButton symbol="minus" label={display.t('Decrease', 'შემცირება')} isEnabled={value > min} onClick={() => adjust(-step)} />
      <StepButton symbol="plus" label={display.t('Increase', 'გაზრდა')} isEnabled={value < max} onClick={() => adjust(step)} />
    </div>
  );
}

interface StepButtonProps {
  symbol: string;
  label: string;
  isEnabled: boolean;
  onClick: () => void;
}

function StepButton({ symbol, label, isEnabled, onClick }: StepButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!isEnabled}
      onClick={onClick}
      className={cx(
        'pressable flex h-9 w-11 shrink-0 items-center justify-center rounded-sm bg-cream',
        isEnabled ? 'text-ink' : 'text-inkMuted',
      )}
    >
      <Icon name={symbol} size={14} />
    </button>
  );
}
