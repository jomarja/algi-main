import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

export type StatusKind = 'info' | 'success' | 'warning' | 'error';

/** Warnings use amber rather than red so budget nudges never feel alarming. */
export const statusStyles: Record<StatusKind, { symbol: string; tint: string; background: string }> = {
  info: { symbol: 'info.circle.fill', tint: 'text-lavender', background: 'bg-lavenderPale' },
  success: { symbol: 'checkmark.circle.fill', tint: 'text-mint', background: 'bg-mintPale' },
  warning: { symbol: 'exclamationmark.circle.fill', tint: 'text-amberDeep', background: 'bg-amberPale' },
  error: { symbol: 'xmark.octagon.fill', tint: 'text-coralDeep', background: 'bg-coralPale' },
};

interface StatusBannerProps {
  kind: StatusKind;
  title: string;
  message?: string;
  className?: string;
}

/** Inline feedback for info, success, warning, and error states. */
export function StatusBanner({ kind, title, message, className }: StatusBannerProps) {
  const style = statusStyles[kind];
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-md p-4', style.background, className)}
    >
      <span className={cx('flex w-6 shrink-0 justify-center pt-px', style.tint)}>
        <Icon name={style.symbol} size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-subheadline font-semibold text-ink">{title}</p>
        {message && <p className="type-footnote text-inkSoft">{message}</p>}
      </div>
    </div>
  );
}
