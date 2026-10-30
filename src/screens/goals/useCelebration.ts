import { useCallback, useEffect, useRef, useState } from 'react';
import type { Celebration } from '../../engine/index.ts';

/** Long enough for the add-money sheet to slide away first. */
const AFTER_SHEET_DELAY = 320;

/**
 * The milestone celebration after adding money. It opens once the add-money sheet has closed, so focus is back on
 * the "Add money" button and returns there when the celebration is dismissed.
 */
export function useCelebration() {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const celebrate = useCallback((next: Celebration | null) => {
    if (!next) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCelebration(next), AFTER_SHEET_DELAY);
  }, []);

  const dismiss = useCallback(() => setCelebration(null), []);

  return { celebration, celebrate, dismiss };
}
