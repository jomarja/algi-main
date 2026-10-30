import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';
import { useIsLaptop } from './media.ts';
import { lockPage, useFocusTrap, usePresence } from './overlay.ts';

export interface SheetAction {
  title: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Shown in the sheet's bar and used as its accessible name. */
  title: string;
  /** Left of the bar, e.g. Cancel. */
  leadingAction?: SheetAction;
  /** Right of the bar, e.g. Save or Done. Without either action, a close button appears on the right. */
  trailingAction?: SheetAction;
  /** Laptop presentation: a centred dialog, or a panel sliding in from the right. Phones always get a bottom sheet. */
  presentation?: 'dialog' | 'panel';
  /** Phone height: fit the content, or take nearly the whole screen like iOS's large detent. */
  detent?: 'fit' | 'large';
  /** Backdrop click, Escape and swipe-down close it; turn off to protect unsaved input. */
  dismissible?: boolean;
  /** Pinned under the scrolling content, e.g. a primary button. */
  footer?: ReactNode;
  children: ReactNode;
}

type Layout = 'sheet' | 'dialog' | 'panel';

const exitDuration = 300;
/** A swipe further than this, or a flick faster than `dismissVelocity` (px/ms), closes the sheet. */
const dismissDistance = 120;
const dismissVelocity = 0.6;
/** Shorter moves are jitter, however fast. */
const flickDistance = 24;

const layoutClasses: Record<Layout, { frame: string; surface: string; hidden: string; shown: string }> = {
  sheet: {
    frame: 'items-end',
    surface: 'w-full rounded-t-xl',
    hidden: 'translate-y-full',
    shown: 'translate-y-0',
  },
  dialog: {
    frame: 'items-center justify-center p-6',
    surface: 'w-full max-w-[520px] max-h-[min(760px,calc(100dvh-48px))] rounded-xl shadow-2xl',
    hidden: 'scale-[0.96] opacity-0',
    shown: 'scale-100 opacity-100',
  },
  panel: {
    frame: 'justify-end',
    surface: 'h-full w-full max-w-[440px] shadow-2xl',
    hidden: 'translate-x-full',
    shown: 'translate-x-0',
  },
};

/**
 * A modal sheet: a bottom sheet with a grabber on phones, a centred dialog (or side panel) on laptops.
 * Traps focus, closes on Escape, locks the page behind it, and animates in and out with transforms only.
 */
export function Sheet(props: SheetProps) {
  const { isMounted, isVisible } = usePresence(props.isOpen, exitDuration);
  if (!isMounted) return null;
  return createPortal(<SheetLayer {...props} isVisible={isVisible} />, document.body);
}

interface DragState {
  startY: number;
  startTime: number;
}

function SheetLayer({
  isOpen,
  onClose,
  title,
  leadingAction,
  trailingAction,
  presentation = 'dialog',
  detent = 'fit',
  dismissible = true,
  footer,
  children,
  isVisible,
}: SheetProps & { isVisible: boolean }) {
  const display = useDisplay();
  const isLaptop = useIsLaptop();
  const layout: Layout = isLaptop ? presentation : 'sheet';
  const classes = layoutClasses[layout];
  const titleId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setDragging] = useState(false);

  // Declared before the focus trap so that on close the page is interactive again before focus returns to it.
  useEffect(() => (isOpen ? lockPage() : undefined), [isOpen]);
  useFocusTrap(surface, isOpen, dismissible ? onClose : undefined);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const isOnControl = event.target instanceof Element && event.target.closest('button, a, input') !== null;
    if (layout !== 'sheet' || !dismissible || isOnControl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startTime: performance.now() };
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const distance = event.clientY - drag.current.startY;
    // Pulling up resists, like a rubber band; pulling down follows the finger.
    setDragOffset(distance > 0 ? distance : distance / 4);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const distance = event.clientY - drag.current.startY;
    const velocity = distance / Math.max(performance.now() - drag.current.startTime, 1);
    drag.current = null;
    setDragging(false);
    const shouldDismiss = distance > dismissDistance || (distance > flickDistance && velocity > dismissVelocity);
    // Dismissing slides on down from where the finger let go; otherwise the sheet springs back.
    setDragOffset(shouldDismiss ? window.innerHeight : 0);
    if (shouldDismiss) onClose();
  };

  return (
    <div className={cx('fixed inset-0 z-50 flex', classes.frame)}>
      <div
        aria-hidden
        onClick={dismissible ? onClose : undefined}
        className={cx(
          'absolute inset-0 bg-ink/40 transition-opacity duration-300 ease-out',
          isVisible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={surface}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex flex-col overflow-hidden bg-paper outline-none',
          classes.surface,
          layout === 'sheet' &&
            (detent === 'large' ? 'h-[calc(100dvh-var(--safe-top)-10px)]' : 'max-h-[calc(100dvh-var(--safe-top)-10px)]'),
          !isDragging && 'transition-[transform,opacity] duration-300 ease-out',
          isVisible ? classes.shown : classes.hidden,
        )}
        style={dragOffset !== 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="touch-none">
          {layout === 'sheet' && <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-line" />}
          <div className="grid min-h-[52px] grid-cols-[minmax(72px,1fr)_minmax(0,auto)_minmax(72px,1fr)] items-center gap-2 px-4">
            <div className="justify-self-start">
              {leadingAction && <BarButton action={leadingAction} />}
            </div>
            <h2 id={titleId} className="type-headline truncate text-center text-ink">
              {title}
            </h2>
            <div className="justify-self-end">
              {trailingAction ? (
                <BarButton action={trailingAction} isProminent />
              ) : (
                !leadingAction && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={display.t('Close', 'დახურვა')}
                    className="pressable-dim flex h-11 w-11 items-center justify-center rounded-full text-inkSoft"
                  >
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-cream">
                      <Icon name="xmark" size={14} />
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
        <div
          className={cx(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5',
            footer ? 'pb-4' : 'pb-[calc(20px+var(--safe-bottom))]',
          )}
        >
          {children}
        </div>
        {footer && <div className="border-t border-line bg-paper px-5 pb-[calc(12px+var(--safe-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  );
}

function BarButton({ action, isProminent = false }: { action: SheetAction; isProminent?: boolean }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cx(
        'type-body pressable-dim min-h-[44px] px-1 text-ink disabled:text-inkMuted',
        isProminent && 'font-semibold',
      )}
    >
      {action.title}
    </button>
  );
}
