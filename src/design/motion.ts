import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/**
 * Plays a Web Animation on `element` each time `trigger` changes (not on mount), like SwiftUI's
 * `keyframeAnimator(trigger:)`. A new trigger, or unmounting, cancels the previous run.
 */
export function usePlayOnChange(
  element: RefObject<HTMLElement>,
  trigger: number,
  isEnabled: boolean,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): void {
  const previousTrigger = useRef(trigger);

  useEffect(() => {
    if (previousTrigger.current === trigger) return;
    previousTrigger.current = trigger;
    const target = element.current;
    if (!isEnabled || !target) return;
    const animation = target.animate(keyframes, options);
    return () => animation.cancel();
  }, [element, trigger, isEnabled, keyframes, options]);
}
