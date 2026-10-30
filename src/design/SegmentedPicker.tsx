import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { APP_LANGUAGES, LANGUAGE_INFO } from '../engine/localization.ts';
import type { AppLanguage } from '../engine/localization.ts';
import { CURRENCIES, CURRENCY_SYMBOLS } from '../engine/money.ts';
import type { CurrencyCode } from '../engine/money.ts';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { cx } from './cx.ts';

interface SegmentedPickerProps<Option extends string> {
  options: readonly Option[];
  value: Option;
  onChange: (option: Option) => void;
  title: (option: Option) => string;
  /** Accessible name of the group, e.g. "Language". */
  label: string;
  className?: string;
}

const keySteps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Segmented control from the Figma design: a cream track with a raised white selection that slides between
 * options. A radio group for assistive technology: arrow keys move and select, Home/End jump to the ends.
 */
export function SegmentedPicker<Option extends string>({
  options,
  value,
  onChange,
  title,
  label,
  className,
}: SegmentedPickerProps<Option>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(options.indexOf(value), 0);
  const count = options.length;

  const select = (index: number) => {
    const wrapped = (index + count) % count;
    onChange(options[wrapped]);
    buttons.current[wrapped]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key in keySteps) select(selectedIndex + keySteps[event.key]);
    else if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(count - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cx('relative flex gap-1 rounded-md bg-cream p-1', className)}
    >
      <span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 rounded-sm bg-surface shadow-[0_1px_4px_rgba(22,60,53,0.08)] transition-transform duration-[250ms] ease-snappy"
        style={{
          width: `calc((100% - 8px - ${(count - 1) * 4}px) / ${count})`,
          transform: `translateX(calc(${selectedIndex} * (100% + 4px)))`,
        }}
      />
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <button
            key={option}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option)}
            className={cx(
              'type-subheadline relative min-h-[40px] min-w-0 flex-1 truncate rounded-sm px-2 font-semibold transition-colors',
              isSelected ? 'text-ink' : 'text-inkSoft',
            )}
          >
            {title(option)}
          </button>
        );
      })}
    </div>
  );
}

/** English / ქართული switcher, used on the welcome screen and in Settings. */
export function LanguageSwitcher({
  value,
  onChange,
  className,
}: {
  value: AppLanguage;
  onChange: (language: AppLanguage) => void;
  className?: string;
}) {
  const display = useDisplay();
  return (
    <SegmentedPicker
      options={APP_LANGUAGES}
      value={value}
      onChange={onChange}
      title={(language) => LANGUAGE_INFO[language].nativeName}
      label={display.t('Language', 'ენა')}
      className={className}
    />
  );
}

export function CurrencyPicker({
  value,
  onChange,
  className,
}: {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  className?: string;
}) {
  const display = useDisplay();
  return (
    <SegmentedPicker
      options={CURRENCIES}
      value={value}
      onChange={onChange}
      title={(currency) => `${CURRENCY_SYMBOLS[currency]} ${currency}`}
      label={display.t('Display currency', 'საჩვენებელი ვალუტა')}
      className={className}
    />
  );
}
