import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';
import { palette } from './tokens.ts';
import type { PaletteToken } from './tokens.ts';

interface OverlineProps {
  children: ReactNode;
  tone?: PaletteToken;
  /** Leading SF Symbol, as in "✦ YOUR NEXT STEP". */
  icon?: string;
  as?: 'p' | 'h2' | 'h3' | 'span';
  className?: string;
}

/** Small uppercase label above a section, e.g. "WHERE YOU ARE" (iOS overlineStyle). */
export function Overline({ children, tone = 'inkSoft', icon, as: Component = 'p', className }: OverlineProps) {
  return (
    <Component className={cx('type-overline flex items-center gap-1', className)} style={{ color: palette[tone] }}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </Component>
  );
}
