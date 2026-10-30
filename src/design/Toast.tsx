import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';
import { statusStyles } from './StatusBanner.tsx';
import type { StatusKind } from './StatusBanner.tsx';

export interface ToastOptions {
  kind?: StatusKind;
  title: string;
  message?: string;
  /** How long it stays, in ms. */
  duration?: number;
}

interface ToastEntry extends Required<Omit<ToastOptions, 'message'>> {
  id: number;
  message?: string;
}

interface ToastApi {
  show(toast: ToastOptions): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const maxVisible = 3;
const exitDuration = 250;

/** Hosts transient banners at the top of the screen, announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const show = useCallback((toast: ToastOptions) => {
    const entry: ToastEntry = { kind: 'success', duration: 3500, ...toast, id: nextId.current++ };
    setToasts((current) => [...current, entry].slice(-maxVisible));
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+12px)] z-[60] flex flex-col items-center gap-2 px-4"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={remove} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastEntry; onRemove: (id: number) => void }) {
  const [isVisible, setVisible] = useState(false);
  const style = statusStyles[toast.kind];

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    const hide = window.setTimeout(() => setVisible(false), toast.duration);
    const removal = window.setTimeout(() => onRemove(toast.id), toast.duration + exitDuration);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(hide);
      window.clearTimeout(removal);
    };
  }, [toast, onRemove]);

  return (
    <button
      type="button"
      onClick={() => onRemove(toast.id)}
      className={cx(
        'pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-md p-4 text-left shadow-[0_8px_24px_rgba(22,60,53,0.16)]',
        'transition-[transform,opacity] duration-[250ms] ease-out',
        style.background,
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
      )}
    >
      <span className={cx('flex w-6 shrink-0 justify-center pt-px', style.tint)}>
        <Icon name={style.symbol} size={20} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="type-subheadline font-semibold text-ink">{toast.title}</span>
        {toast.message && <span className="type-footnote text-inkSoft">{toast.message}</span>}
      </span>
    </button>
  );
}

/** `show({ kind, title, message })` displays a toast. Must be used inside <ToastProvider>. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
