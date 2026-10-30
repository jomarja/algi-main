import type { CSSProperties } from 'react';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { cx } from './cx.ts';

/** A placeholder block with a soft shimmer (still when Reduce Motion is on). Size it with `className`. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden className={cx('relative block overflow-hidden rounded-sm bg-line/70', className)} style={style}>
      <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </span>
  );
}

const lineWidths = ['100%', '92%', '68%', '84%'];

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, line) => (
        <Skeleton key={line} className="h-3.5" style={{ width: lineWidths[line % lineWidths.length] }} />
      ))}
    </span>
  );
}

/** Stand-in for a card with an icon and a couple of lines, e.g. while a transaction list loads. */
export function SkeletonCard() {
  return (
    <span aria-hidden className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-4">
      <Skeleton className="h-11 w-11 shrink-0 rounded-[14px]" />
      <span className="flex-1">
        <SkeletonText lines={2} />
      </span>
    </span>
  );
}

/** Shown while a screen's code loads: a title bar and a few cards. */
export function ScreenSkeleton() {
  const display = useDisplay();
  return (
    <div role="status" aria-label={display.t('Loading…', 'იტვირთება…')} className="flex flex-col gap-5 px-5 pb-8 pt-safe md:px-8">
      <Skeleton className="mx-auto mt-4 h-5 w-32" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
