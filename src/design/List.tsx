import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';
import { Pressable } from './Pressable.tsx';
import type { PressableTarget } from './Pressable.tsx';

interface ListSectionProps {
  header?: string;
  footer?: string;
  children: ReactNode;
}

/** A group of rows on a white rounded surface with inset separators (SwiftUI's inset-grouped List section). */
export function ListSection({ header, footer, children }: ListSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      {header && <h2 className="type-footnote px-4 uppercase tracking-[0.02em] text-inkSoft">{header}</h2>}
      <div className="list-rows overflow-hidden rounded-sm bg-surface">{children}</div>
      {footer && <p className="type-footnote px-4 text-inkSoft">{footer}</p>}
    </section>
  );
}

/** A row with custom content, e.g. a picker or a toggle. */
export function ListItem({ children }: { children: ReactNode }) {
  return <div className="relative px-4 py-2">{children}</div>;
}

interface ListRowProps extends PressableTarget {
  title: string;
  /** Secondary text on the right, e.g. a masked personal number. */
  value?: string;
  icon?: string;
  /** Coral text for actions such as "Delete account". */
  destructive?: boolean;
  /** Replaces the value and chevron, e.g. a Tag. */
  trailing?: ReactNode;
}

/** A tappable or static row. Links get a disclosure chevron; buttons read as actions. */
export function ListRow({ title, value, icon, destructive = false, trailing, to, onClick }: ListRowProps) {
  const isLink = to !== undefined;
  const isPressable = isLink || onClick !== undefined;

  return (
    <Pressable
      to={to}
      onClick={onClick}
      className={cx(
        'relative flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left',
        isPressable && 'transition-colors hover:bg-cream/50 active:bg-cream',
      )}
    >
      {icon && (
        <span className={destructive ? 'text-coralDeep' : 'text-inkSoft'}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className={cx('type-body min-w-0 flex-1', destructive ? 'text-coralDeep' : 'text-ink')}>{title}</span>
      {trailing ?? (value && <span className="type-body shrink-0 text-inkMuted">{value}</span>)}
      {isLink && !trailing && (
        <span className="text-inkMuted/70">
          <Icon name="chevron.right" size={14} />
        </span>
      )}
    </Pressable>
  );
}
