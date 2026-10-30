import { useCallback, useSyncExternalStore } from 'react';
import { breakpoints } from './tokens.ts';

/** Live result of a CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
export const laptopQuery = `(min-width: ${breakpoints.laptop}px)`;
export const wideQuery = `(min-width: ${breakpoints.wide}px)`;
/** A mouse or trackpad, i.e. no pull gestures; laptops get buttons and shortcuts instead. */
export const finePointerQuery = '(hover: hover) and (pointer: fine)';

/** The iOS "Reduce Motion" setting's web equivalent. */
export function useReducedMotion(): boolean {
  return useMediaQuery(reducedMotionQuery);
}

/** True from the laptop breakpoint up: sidebar navigation, dialogs instead of bottom sheets. */
export function useIsLaptop(): boolean {
  return useMediaQuery(laptopQuery);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(reducedMotionQuery).matches;
}
