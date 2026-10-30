import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { motion, useReducedMotion } from '../../../design/index.ts';

const keyframes: Keyframe[] = [
  { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
  { opacity: 1, transform: 'none' },
];

/**
 * Fades and lifts an element in when it first appears (SwiftUI's default insertion), using transform and opacity
 * only. Skipped with Reduce Motion, and for content that was already there (`isEnabled` false).
 */
export function useEntranceAnimation(element: RefObject<HTMLElement>, isEnabled: boolean): void {
  const isMotionReduced = useReducedMotion();

  // Mount only: an element that is already showing never animates in again.
  useLayoutEffect(() => {
    const target = element.current;
    if (!isEnabled || isMotionReduced || !target) return;
    const animation = target.animate(keyframes, { duration: motion.duration.base, easing: motion.easing.out });
    return () => animation.cancel();
  }, []);
}
