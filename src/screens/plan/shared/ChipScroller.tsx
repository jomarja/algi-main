import type { ReactNode } from 'react';

/**
 * A row of chips that scrolls sideways on phones (iOS horizontal ScrollView) and wraps on laptops,
 * where sideways scrolling with a mouse is awkward.
 */
export function ChipScroller({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="scrollbar-none -my-1 flex gap-2 overflow-x-auto py-1 md:flex-wrap md:overflow-visible">
      {children}
    </div>
  );
}
