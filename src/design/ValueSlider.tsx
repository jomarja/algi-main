import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ValueAdjustment } from '../engine/valueAdjustment.ts';
import { palette } from './tokens.ts';
import type { PaletteToken } from './tokens.ts';

const thumbSize = 26;

interface ValueSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  tint?: PaletteToken;
  /** Accessible name, e.g. "Monthly savings". */
  label: string;
  /** Spoken value, e.g. a formatted amount; defaults to the plain number. */
  valueText?: string;
  disabled?: boolean;
}

/**
 * A drag-to-adjust track (ValueSlider.swift) exposed as an ARIA slider: arrows step, Page Up/Down move a tenth
 * of the range, Home/End jump to the ends. Horizontal drags adjust it; vertical drags still scroll the page.
 */
export function ValueSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  tint = 'mint',
  label,
  valueText,
  disabled = false,
}: ValueSliderProps) {
  const isDragging = useRef(false);
  const range = { lower: min, upper: max };
  const position = ValueAdjustment.fraction(value, range);

  const commit = (raw: number) => {
    const next = ValueAdjustment.snapped(raw, range, step);
    if (next !== value) onChange(next);
  };

  const valueAt = (clientX: number, track: HTMLElement) => {
    const rect = track.getBoundingClientRect();
    const travel = Math.max(rect.width - thumbSize, 1);
    const offset = Math.min(Math.max(clientX - rect.left - thumbSize / 2, 0), travel);
    return min + (offset / travel) * (max - min);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    isDragging.current = true;
    commit(valueAt(event.clientX, event.currentTarget));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isDragging.current) commit(valueAt(event.clientX, event.currentTarget));
  };

  const endDrag = () => {
    isDragging.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const page = Math.max(step, (max - min) / 10);
    const targets: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + page,
      PageDown: value - page,
      Home: min,
      End: max,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    commit(targets[event.key]);
  };

  const offset = `calc(${position} * (100% - ${thumbSize}px))`;

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText ?? String(Math.round(value))}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="relative h-9 w-full cursor-pointer touch-pan-y rounded-full outline-offset-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
      <span
        aria-hidden
        className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{ width: `calc(${offset} + ${thumbSize / 2}px)`, backgroundColor: palette[tint] }}
      />
      <span
        aria-hidden
        className="absolute top-1/2 rounded-full border-2 bg-surface shadow-[0_1px_3px_rgba(22,60,53,0.18)]"
        style={{
          width: thumbSize,
          height: thumbSize,
          left: offset,
          marginTop: -thumbSize / 2,
          borderColor: palette[tint],
        }}
      />
    </div>
  );
}
