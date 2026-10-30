import type { ChangeEvent, ReactNode } from 'react';
import { cx } from '../../design/index.ts';

interface MenuSelectProps<Option extends string> {
  value: Option;
  options: readonly Option[];
  onChange: (option: Option) => void;
  title: (option: Option) => string;
  /** Accessible name, e.g. "Display currency". */
  label: string;
  /** Classes for the visible face, e.g. a capsule or a list row. */
  className?: string;
  /** What shows: usually the current value and a chevron. */
  children: ReactNode;
}

/**
 * A SwiftUI `Menu` picker for the web: any face you draw, with an invisible native select over it, so phones get
 * their own picker and keyboards and screen readers get a real select. Focus rings the face.
 */
export function MenuSelect<Option extends string>({ value, options, onChange, title, label, className, children }: MenuSelectProps<Option>) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = options.find((candidate) => candidate === event.target.value);
    if (option !== undefined) onChange(option);
  };

  return (
    <span
      className={cx(
        'relative has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-mintDark',
        className,
      )}
    >
      {children}
      <select
        aria-label={label}
        value={value}
        onChange={handleChange}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {title(option)}
          </option>
        ))}
      </select>
    </span>
  );
}
