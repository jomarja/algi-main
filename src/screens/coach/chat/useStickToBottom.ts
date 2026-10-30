import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useReducedMotion } from '../../../design/index.ts';

/** This close to the end counts as being at the latest message. */
const NEAR_BOTTOM_PX = 72;

function distanceFromBottom(): number {
  return document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
}

function scrollToEnd(behavior: ScrollBehavior): void {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
}

export interface StickToBottom {
  /** False once the user has scrolled up away from the latest message. */
  readonly isAtBottom: boolean;
  /** Keeps the latest message in view from now on, e.g. when the user sends a question. */
  follow(): void;
  /** Scrolls back to the latest message and keeps following it. */
  scrollToLatest(): void;
}

/**
 * Keeps the newest message in view as the conversation grows, including while an answer streams in, but never
 * pulls the page away from someone who scrolled up to read: scrolling up stops following, and coming back to the
 * end starts again. The window is the scroll container, as on every screen.
 */
export function useStickToBottom(content: RefObject<HTMLElement>): StickToBottom {
  const isFollowing = useRef(false);
  const [isAtBottom, setAtBottom] = useState(true);
  const isMotionReduced = useReducedMotion();

  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const y = window.scrollY;
      const isNearBottom = distanceFromBottom() <= NEAR_BOTTOM_PX;
      if (isNearBottom) isFollowing.current = true;
      else if (y < lastY) isFollowing.current = false;
      lastY = y;
      setAtBottom(isNearBottom);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const element = content.current;
    if (!element) return;
    // Jumps rather than glides: a smooth scroll per streamed line would lag behind and stutter.
    const observer = new ResizeObserver(() => {
      if (isFollowing.current) scrollToEnd('auto');
      setAtBottom(distanceFromBottom() <= NEAR_BOTTOM_PX);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [content]);

  const follow = useCallback(() => {
    isFollowing.current = true;
  }, []);

  const scrollToLatest = useCallback(() => {
    isFollowing.current = true;
    scrollToEnd(isMotionReduced ? 'auto' : 'smooth');
  }, [isMotionReduced]);

  return { isAtBottom, follow, scrollToLatest };
}
