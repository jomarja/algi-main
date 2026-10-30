import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Card, Icon, cx } from '../../../design/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';

/** "How was this calculated?": a card that expands to show the method behind a figure. */
export function MethodDisclosure({ icon, children }: { icon: string; children: ReactNode }) {
  const display = useDisplay();
  const [isOpen, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Card className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setOpen((open) => !open)}
        className="pressable-dim flex min-h-[44px] w-full items-center gap-2 text-left"
      >
        <span className="text-mintDark">
          <Icon name={icon} size={16} />
        </span>
        <span className="type-subheadline flex-1 font-semibold text-mintDark">
          {display.t('How was this calculated?', 'როგორ დაითვალა?')}
        </span>
        <span className={cx('text-inkMuted transition-transform duration-200 ease-snappy', isOpen && 'rotate-180')}>
          <Icon name="chevron.down" size={14} />
        </span>
      </button>
      {isOpen && (
        <div id={panelId} className="flex animate-page-fade flex-col items-start gap-2">
          {children}
        </div>
      )}
    </Card>
  );
}
