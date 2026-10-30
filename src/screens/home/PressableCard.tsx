import type { ReactNode } from 'react';
import { cx, Pressable } from '../../design/index.ts';
import type { PressableTarget } from '../../design/index.ts';

/** Backgrounds a tappable card uses in the iOS app; literal classes so Tailwind keeps them. */
const tones = {
  surface: 'border border-line bg-surface',
  mintPale: 'bg-mintPale',
  amberPale: 'bg-amberPale',
} as const;

const paddings = { s: 'p-3', m: 'p-4' } as const;

interface PressableCardProps extends PressableTarget {
  /** White with a hairline border, or a borderless tint (iOS `.card(background:bordered: false)`). */
  tone?: keyof typeof tones;
  padding?: keyof typeof paddings;
  /** Layout of the content, e.g. 'items-center gap-3'. */
  className?: string;
  'aria-label'?: string;
  /** Inside a button only phrasing content is valid, so build the content from spans. */
  children: ReactNode;
}

/** A card that is itself the link or button (iOS `.card()` inside a Button or NavigationLink), with the press dim. */
export function PressableCard({ tone = 'surface', padding = 'm', className, children, to, onClick, 'aria-label': ariaLabel }: PressableCardProps) {
  return (
    <Pressable
      to={to}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx('pressable flex w-full rounded-lg text-left', tones[tone], paddings[padding], className)}
    >
      {children}
    </Pressable>
  );
}
