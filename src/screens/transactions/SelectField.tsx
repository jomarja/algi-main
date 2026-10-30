import { useId } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { cx, Icon } from '../../design/index.ts';

interface SelectFieldProps<Option extends string> {
  label: string;
  value: Option;
  options: readonly Option[];
  onChange: (option: Option) => void;
  title: (option: Option) => string;
  /** Shown before the value, e.g. the category's icon. */
  leading?: ReactNode;
  className?: string;
}

/** A labelled native select that looks like `TextField`, for form rows such as currency and category. */
export function SelectField<Option extends string>({ label, value, options, onChange, title, leading, className }: SelectFieldProps<Option>) {
  const id = useId();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = options.find((candidate) => candidate === event.target.value);
    if (option !== undefined) onChange(option);
  };

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="type-footnote font-semibold text-inkSoft">
        {label}
      </label>
      <div className="relative flex min-h-[52px] items-center gap-2 rounded-md bg-surface pl-4 ring-1 ring-inset ring-line transition-shadow focus-within:ring-2 focus-within:ring-mint">
        {leading}
        <select
          id={id}
          value={value}
          onChange={handleChange}
          className="type-body min-h-[52px] min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-10 font-semibold text-ink focus-visible:outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {title(option)}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-4 text-inkMuted">
          <Icon name="chevron.down" size={14} />
        </span>
      </div>
    </div>
  );
}
