import type { HTMLAttributes } from 'react';
import { Link } from '../layout/router/Link.tsx';
import { cx } from './cx.ts';
import { palette, spacing } from './tokens.ts';
import type { PaletteToken, SpacingToken } from './tokens.ts';
import { Overline } from './Typography.tsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  background?: PaletteToken;
  padding?: SpacingToken;
  bordered?: boolean;
}

/** A rounded surface with a hairline border (iOS `.card()`). Wrap it in a Link to make it tappable. */
export function Card({ background = 'surface', padding = 'm', bordered = true, className, style, ...rest }: CardProps) {
  return (
    <div
      className={cx('w-full rounded-lg', bordered && 'border border-line', className)}
      style={{ backgroundColor: palette[background], padding: spacing[padding], ...style }}
      {...rest}
    />
  );
}

interface SectionHeaderProps {
  title: string;
  overline?: string;
  actionTitle?: string;
  /** Where the action goes, e.g. "See all" → '/transactions'. */
  actionTo?: string;
  onAction?: () => void;
  /** Heading level for the document outline; sections inside a screen are h2 by default. */
  level?: 2 | 3;
}

/** Section title with an optional trailing action such as "See all". */
export function SectionHeader({ title, overline, actionTitle, actionTo, onAction, level = 2 }: SectionHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const actionClass = 'type-subheadline min-h-[44px] shrink-0 font-semibold text-mintDark pressable-dim inline-flex items-center';

  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {overline && <Overline>{overline}</Overline>}
        <Heading className="type-title3 text-ink">{title}</Heading>
      </div>
      {actionTitle && actionTo !== undefined && (
        <Link to={actionTo} className={actionClass}>
          {actionTitle}
        </Link>
      )}
      {actionTitle && actionTo === undefined && onAction && (
        <button type="button" onClick={onAction} className={actionClass}>
          {actionTitle}
        </button>
      )}
    </div>
  );
}

interface DetailRowProps {
  title: string;
  value: string;
  valueTone?: PaletteToken;
}

/** A label/value pair for detail screens and breakdowns. */
export function DetailRow({ title, value, valueTone = 'ink' }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="type-subheadline text-inkSoft">{title}</span>
      <span className="type-subheadline text-right font-semibold" style={{ color: palette[valueTone] }}>
        {value}
      </span>
    </div>
  );
}

/** A hairline separator; `inset` lines it up with row text after a leading icon (iOS uses 56 after a 44pt icon). */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <hr className="border-0 border-t border-line" style={{ marginLeft: inset }} />;
}
