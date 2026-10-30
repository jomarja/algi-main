import { cx } from './cx.ts';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Smaller text under the label. */
  description?: string;
  disabled?: boolean;
}

/** An iOS switch row: the label on the left, a mint switch on the right. The whole row toggles. */
export function Toggle({ label, checked, onChange, description, disabled = false }: ToggleProps) {
  return (
    <label className={cx('flex min-h-[44px] items-center justify-between gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="type-body text-ink">{label}</span>
        {description && <span className="type-footnote text-inkSoft">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-mint' : 'bg-line',
        )}
      >
        <span
          aria-hidden
          className={cx(
            'absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]',
            'transition-transform duration-200 ease-snappy',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </label>
  );
}
