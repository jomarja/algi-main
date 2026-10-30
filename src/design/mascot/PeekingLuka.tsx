import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { cx } from '../cx.ts';
import { Icon } from '../Icon.tsx';
import { finePointerQuery, useMediaQuery, useReducedMotion } from '../media.ts';
import { delay } from '../motion.ts';
import { MascotView, PropView } from './MascotView.tsx';
import { peekReveal, peekVisibleHeight, rubberBand } from './peek.ts';

/** The pull-to-refresh "sync" lasts at least this long, so Luka has time to peek. */
const minimumRefreshDuration = 1500;
/** Hands appear once he's this far up. */
const handsThreshold = 0.25;

interface PeekingLukaProps {
  /** 0…1, see `peekReveal`. */
  reveal: number;
  isRefreshing: boolean;
  /** While a finger drives `reveal`, Luka follows it directly instead of easing. */
  isTracking?: boolean;
}

/**
 * Pull-to-refresh character: Luka rises from behind the page and peeks over its edge, fingers gripping it,
 * and looks around while the refresh runs. Place it directly above the page's top edge.
 */
export function PeekingLuka({ reveal, isRefreshing, isTracking = false }: PeekingLukaProps) {
  const reduceMotion = useReducedMotion();
  const looksAround = isRefreshing && !reduceMotion;
  const showsHands = reveal > handsThreshold;

  return (
    <div aria-hidden className="relative w-full overflow-hidden" style={{ height: peekVisibleHeight }}>
      <div
        className={cx('absolute left-1/2 top-0 h-[101px] w-[98px] -ml-[49px]', !isTracking && 'transition-transform duration-[350ms] ease-snappy')}
        style={{ transform: `translateY(${(1 - reveal) * peekVisibleHeight}px)` }}
      >
        <div className={cx('h-full w-full origin-bottom', looksAround && 'animate-peek-look-around')}>
          <MascotView pose="peek" decorative className="h-full w-full" />
        </div>
      </div>
      <PropView
        prop="peekingHands"
        className={cx(
          'absolute bottom-0 left-1/2 -ml-[85px] h-[22px] w-[170px] transition-[opacity,transform] duration-300 ease-snappy',
          showsHands ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
        )}
      />
    </div>
  );
}

interface RefreshApi {
  refresh(): void;
  isRefreshing: boolean;
}

const RefreshContext = createContext<RefreshApi | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

interface PullToRefreshProps {
  /** Fetches fresh data. Handle its errors inside (e.g. show a toast); Luka stays up until it settles. */
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

/**
 * The page with Luka hiding behind its top edge (PullToRefreshBackdrop.swift). On touch screens, pulling down at
 * the top of the page lifts the page and Luka peeks over it; releasing past his height refreshes. On laptops the
 * same peek runs from `RefreshButton` or the R key.
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isTracking, setTracking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const isBusy = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  const refresh = useCallback(async () => {
    if (isBusy.current) return;
    isBusy.current = true;
    setRefreshing(true);
    try {
      await Promise.all([onRefreshRef.current(), delay(minimumRefreshDuration)]);
    } finally {
      isBusy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let startY: number | null = null;
    let distance = 0;

    const reset = () => {
      startY = null;
      distance = 0;
      setTracking(false);
      setPullDistance(0);
    };
    const onTouchStart = (event: TouchEvent) => {
      startY = window.scrollY <= 0 && !isBusy.current && event.touches.length === 1 ? event.touches[0].clientY : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (startY === null) return;
      distance = event.touches[0].clientY - startY;
      if (distance <= 0 || window.scrollY > 0) {
        if (distance <= 0) setPullDistance(0);
        return;
      }
      // Our pull replaces the browser's overscroll bounce.
      event.preventDefault();
      setTracking(true);
      setPullDistance(rubberBand(distance));
    };
    const onTouchEnd = () => {
      if (startY !== null && rubberBand(distance) >= peekVisibleHeight) void refresh();
      reset();
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', reset);
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', reset);
    };
  }, [refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPlainR = event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey;
      const isModalOpen = document.getElementById('root')?.inert === true;
      if (!isPlainR || event.defaultPrevented || isModalOpen || isTypingTarget(event.target)) return;
      void refresh();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [refresh]);

  const offset = isRefreshing ? peekVisibleHeight : pullDistance;
  const api = useMemo<RefreshApi>(() => ({ refresh: () => void refresh(), isRefreshing }), [refresh, isRefreshing]);

  return (
    <RefreshContext.Provider value={api}>
      <div ref={root} className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0">
          <PeekingLuka reveal={peekReveal(pullDistance, isRefreshing)} isRefreshing={isRefreshing} isTracking={isTracking} />
        </div>
        <div
          className={cx(
            'relative rounded-t-xl bg-paper',
            !isTracking && 'transition-[transform,box-shadow] duration-[350ms] ease-out',
            offset > 1 && 'shadow-[0_-3px_10px_rgba(22,60,53,0.1)]',
          )}
          // No transform at rest: a transformed ancestor would change how fixed and sticky children position.
          style={{ transform: offset > 0 ? `translateY(${offset}px)` : undefined }}
        >
          {children}
        </div>
      </div>
    </RefreshContext.Provider>
  );
}

/**
 * Refresh for mouse and trackpad users, who can't pull; hidden on touch screens. Must sit inside PullToRefresh.
 */
export function RefreshButton() {
  const display = useDisplay();
  const hasFinePointer = useMediaQuery(finePointerQuery);
  const api = useContext(RefreshContext);
  if (!api) throw new Error('RefreshButton must be used inside <PullToRefresh>');
  if (!hasFinePointer) return null;

  return (
    <button
      type="button"
      onClick={api.refresh}
      disabled={api.isRefreshing}
      aria-busy={api.isRefreshing || undefined}
      aria-label={display.t('Refresh (R)', 'განახლება (R)')}
      title={display.t('Refresh (R)', 'განახლება (R)')}
      className="pressable-dim flex h-9 w-11 items-center justify-center rounded-full border border-line text-ink disabled:text-inkMuted"
    >
      <Icon name="arrow.clockwise" size={17} />
    </button>
  );
}
