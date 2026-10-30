import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useRouter } from '../layout/router/Router.tsx';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

interface NavigationHeaderProps {
  title: string;
  /**
   * 'inline' keeps the title in the bar (iOS `.inline`); 'large' shows a big title under the bar that hands over
   * to the bar as it scrolls away, like iOS tab roots.
   */
  titleDisplay?: 'inline' | 'large';
  /**
   * Where Back goes when there's no history to return to (defaults to the parent screen); a path also shows Back on
   * screens that wouldn't have it. `false` hides Back.
   */
  back?: string | false;
  /** Replaces the Back button, e.g. a Cancel action. */
  leading?: ReactNode;
  /** Buttons on the right of the bar. */
  trailing?: ReactNode;
}

/** True once `target` has scrolled up under the sticky bar. */
function useScrolledPast(target: RefObject<HTMLElement>, barHeight: number): boolean {
  const [isPast, setPast] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting), {
      rootMargin: `-${barHeight}px 0px 0px 0px`,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, barHeight]);
  return isPast;
}

const barHeight = 52;

/** The sticky navigation bar: Back on the left, a centred title, actions on the right, a hairline once scrolled. */
export function NavigationHeader({ title, titleDisplay = 'inline', back, leading, trailing }: NavigationHeaderProps) {
  const display = useDisplay();
  const router = useRouter();
  const sentinel = useRef<HTMLDivElement>(null);
  const largeTitle = useRef<HTMLHeadingElement>(null);
  const isScrolled = useScrolledPast(sentinel, barHeight);
  const isLargeTitleHidden = useScrolledPast(largeTitle, barHeight);
  const isLarge = titleDisplay === 'large';
  const showsBack = !leading && back !== false && (typeof back === 'string' || router.canGoBack);
  const showsBarTitle = !isLarge || isLargeTitleHidden;

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-20 pt-safe transition-[background-color,border-color] duration-200',
          'border-b',
          isScrolled ? 'border-line bg-paper/85 backdrop-blur-xl backdrop-saturate-150' : 'border-transparent bg-paper',
        )}
      >
        <div className="grid min-h-[52px] grid-cols-[minmax(44px,1fr)_minmax(0,auto)_minmax(44px,1fr)] items-center gap-2 px-2 md:px-6">
          <div className="flex items-center justify-self-start">
            {leading}
            {showsBack && (
              <button
                type="button"
                onClick={() => router.back(typeof back === 'string' ? back : undefined)}
                aria-label={display.t('Back', 'უკან')}
                className="pressable-dim flex h-11 w-11 items-center justify-center rounded-full text-ink"
              >
                <Icon name="chevron.left" size={20} />
              </button>
            )}
          </div>
          {isLarge ? (
            <p
              aria-hidden
              className={cx(
                'type-headline truncate text-center text-ink transition-opacity duration-200',
                showsBarTitle ? 'opacity-100' : 'opacity-0',
              )}
            >
              {title}
            </p>
          ) : (
            <h1 className="type-headline truncate text-center text-ink">{title}</h1>
          )}
          <div className="flex items-center gap-1 justify-self-end">{trailing}</div>
        </div>
      </header>
      <div ref={sentinel} aria-hidden className="h-px" />
      {isLarge && (
        <h1 ref={largeTitle} className="type-display px-5 pb-2 font-sans font-bold text-ink md:px-8">
          {title}
        </h1>
      )}
    </>
  );
}

interface HeaderButtonProps {
  icon?: string;
  /** Visible text; icon-only buttons need `label` instead. */
  title?: string;
  label?: string;
  onClick: () => void;
  isProminent?: boolean;
  disabled?: boolean;
}

/** A bar button for `NavigationHeader` actions: an icon or a short word like "Save". */
export function HeaderButton({ icon, title, label, onClick, isProminent = false, disabled = false }: HeaderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cx(
        'type-body pressable-dim flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2 text-ink disabled:text-inkMuted',
        isProminent && 'font-semibold',
      )}
    >
      {icon && <Icon name={icon} size={20} />}
      {title}
    </button>
  );
}
