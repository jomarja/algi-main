import type { ReactNode } from 'react';

/** The short explanation under a screen's title (iOS: callout in inkSoft at the top of the scroll view). */
export function Intro({ children }: { children: ReactNode }) {
  return <p className="type-callout text-inkSoft">{children}</p>;
}
