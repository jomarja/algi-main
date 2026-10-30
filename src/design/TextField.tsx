import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label: string;
  /** Shown under the field with a warning icon; also marks the field invalid. */
  error?: string;
  /** Fixed text before the input, e.g. "+995". */
  prefix?: string;
  /** Helper text under the field when there's no error. */
  hint?: string;
}

/** A labelled input (PersonalInfoForm): mint border while focused, coral with a message when invalid. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, prefix, hint, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="type-footnote font-semibold text-inkSoft">
        {label}
      </label>
      <div
        className={cx(
          'flex min-h-[52px] items-center gap-2 rounded-md bg-surface px-4 transition-shadow',
          error ? 'ring-2 ring-inset ring-coral' : 'ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-mint',
        )}
      >
        {prefix && <span className="type-body font-semibold text-inkSoft">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="type-body min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:font-normal placeholder:text-inkMuted"
          {...rest}
        />
      </div>
      {error && (
        <p id={messageId} className="type-footnote flex items-start gap-1 text-coralDeep">
          <Icon name="exclamationmark.circle.fill" size={14} className="mt-0.5" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={messageId} className="type-footnote text-inkSoft">
          {hint}
        </p>
      )}
    </div>
  );
});
