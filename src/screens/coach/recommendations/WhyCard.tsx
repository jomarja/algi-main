import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Card, cx, Icon } from '../../../design/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { useEntranceAnimation } from '../shared/useEntranceAnimation.ts';

function WhyContent({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEntranceAnimation(ref, true);
  return (
    <div ref={ref} id={id} className="flex flex-col gap-2">
      {children}
    </div>
  );
}

/** "Why am I seeing this?": the data and assumptions behind a suggestion, folded away until asked for. */
export function WhyCard({ isInitiallyExpanded = false, children }: { isInitiallyExpanded?: boolean; children: ReactNode }) {
  const display = useDisplay();
  const [isExpanded, setExpanded] = useState(isInitiallyExpanded);
  const contentId = useId();

  return (
    <Card className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? contentId : undefined}
        className="pressable-dim flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
      >
        <span className="type-subheadline flex items-center gap-2 font-semibold text-mintDark">
          <Icon name="questionmark.circle" size={17} />
          {display.t('Why am I seeing this?', 'რატომ ვხედავ ამას?')}
        </span>
        <Icon name="chevron.down" size={15} className={cx('text-inkMuted transition-transform duration-200', isExpanded && 'rotate-180')} />
      </button>
      {isExpanded && <WhyContent id={contentId}>{children}</WhyContent>}
    </Card>
  );
}

/** A fact or assumption in the card, with the info symbol (iOS `Label(_, systemImage: "info.circle")`). */
export function WhyFact({ children }: { children: ReactNode }) {
  return (
    <p className="type-footnote flex items-start gap-2 text-ink">
      <Icon name="info.circle" size={15} className="mt-px text-inkSoft" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
