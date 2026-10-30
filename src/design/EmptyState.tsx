import type { ReactNode } from 'react';
import { MascotView } from './mascot/MascotView.tsx';
import type { MascotPose } from './mascot/assets.ts';

interface EmptyStateProps {
  pose?: MascotPose;
  title: string;
  message: string;
  /** Buttons stacked under the message. */
  children?: ReactNode;
}

/** Luka on a mint circle with a title, a message, and the next actions. */
export function EmptyState({ pose = 'empty', title, message, children }: EmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-4 p-6 text-center">
      <div className="relative flex h-[200px] items-center">
        <span aria-hidden className="absolute inset-x-0 top-1/2 aspect-square -translate-y-1/2 rounded-full bg-mintPale" />
        <MascotView pose={pose} className="relative h-full w-auto" />
      </div>
      <h2 className="type-title2 text-ink">{title}</h2>
      <p className="type-callout text-inkSoft">{message}</p>
      {children && <div className="flex w-full flex-col gap-3 pt-2">{children}</div>}
    </div>
  );
}
