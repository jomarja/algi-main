import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, ConfettiBurst, MascotView, cx } from '../../design/index.ts';
import { lockPage, useFocusTrap, usePresence } from '../../design/overlay.ts';
import type { Celebration } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

const EXIT_DURATION = 300;

interface MilestoneCelebrationProps {
  /** Shown while set; null hides it. */
  celebration: Celebration | null;
  onClose: () => void;
}

/**
 * Full-screen celebration with Luka and a short confetti burst (MilestoneCelebrationView.swift). Luka springs in;
 * the confetti is skipped with Reduce Motion. Traps focus and closes on Escape like any modal.
 */
export function MilestoneCelebration({ celebration, onClose }: MilestoneCelebrationProps) {
  const isOpen = celebration !== null;
  const { isMounted, isVisible } = usePresence(isOpen, EXIT_DURATION);
  // Keeps the last celebration on screen while it fades out.
  const [shown, setShown] = useState(celebration);
  useEffect(() => {
    if (celebration) setShown(celebration);
  }, [celebration]);

  if (!isMounted || !shown) return null;
  return createPortal(
    <CelebrationLayer celebration={shown} isOpen={isOpen} isVisible={isVisible} onClose={onClose} />,
    document.body,
  );
}

interface CelebrationLayerProps {
  celebration: Celebration;
  isOpen: boolean;
  isVisible: boolean;
  onClose: () => void;
}

function CelebrationLayer({ celebration, isOpen, isVisible, onClose }: CelebrationLayerProps) {
  const display = useDisplay();
  const surface = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => (isOpen ? lockPage() : undefined), [isOpen]);
  useFocusTrap(surface, isOpen, onClose);

  return (
    <div
      ref={surface}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      tabIndex={-1}
      className={cx(
        'fixed inset-0 z-[55] flex flex-col bg-mintPale outline-none transition-opacity duration-300 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <ConfettiBurst isActive={isVisible} />
      <div className="relative mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center gap-5 px-6 pb-[calc(24px+var(--safe-bottom))] pt-[calc(24px+var(--safe-top))] text-center">
        <div className="flex-1" />
        <MascotView
          pose="achievement"
          className="h-[300px] w-auto transition-transform duration-700 ease-bouncy"
          style={{ transform: isVisible ? 'none' : 'translateY(24px) scale(0.85)' }}
        />
        <h2 id={titleId} className="type-title text-ink">
          {celebration.title}
        </h2>
        <p id={messageId} className="type-body text-inkSoft">
          {celebration.message}
        </p>
        <div className="flex-1" />
        <Button onClick={onClose}>{display.t('Keep going', 'გავაგრძელოთ')}</Button>
      </div>
    </div>
  );
}
