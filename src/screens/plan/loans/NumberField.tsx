import { useEffect, useRef, useState } from 'react';
import { formatFieldNumber, parseFieldNumber } from './loanModel.ts';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Keeps typed values within what the maths accepts, e.g. 0–100 for a rate. */
  clamp: (value: number) => number;
}

/**
 * A label with a number field on the right (LoanComparisonView.swift `numberField`). Typing updates the value as soon
 * as the text is a valid number; leaving the field shows the value as it was understood (e.g. clamped to 100%).
 */
export function NumberField({ label, value, onChange, clamp }: NumberFieldProps) {
  const [text, setText] = useState(() => formatFieldNumber(value));
  const committed = useRef(value);

  // A value that changes from elsewhere (e.g. bank data arriving) replaces the text.
  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setText(formatFieldNumber(value));
  }, [value]);

  const handleChange = (input: string) => {
    setText(input);
    const parsed = parseFieldNumber(input);
    if (parsed === null) return;
    const next = clamp(parsed);
    committed.current = next;
    onChange(next);
  };

  return (
    <label className="flex min-h-[36px] items-center justify-between gap-3">
      <span className="type-subheadline text-inkSoft">{label}</span>
      <input
        inputMode="decimal"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setText(formatFieldNumber(committed.current))}
        autoComplete="off"
        className="type-subheadline w-full max-w-[120px] rounded-sm bg-transparent px-2 py-1 text-right font-semibold text-ink transition-colors focus:bg-cream"
      />
    </label>
  );
}
