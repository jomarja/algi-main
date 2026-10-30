import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Keeps an overlay mounted while it animates out. `isVisible` turns on a frame after mounting so CSS
 * transitions run from the hidden state, and turns off `exitDuration` ms before unmounting.
 */
export function usePresence(isOpen: boolean, exitDuration: number): { isMounted: boolean; isVisible: boolean } {
  const [isMounted, setMounted] = useState(isOpen);
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), exitDuration);
    return () => window.clearTimeout(timer);
  }, [isOpen, exitDuration]);

  return { isMounted, isVisible };
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function focusablesIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.getClientRects().length > 0,
  );
}

/** Open modal layers, innermost last; only the innermost one traps focus and answers Escape. */
const modalStack: object[] = [];

/**
 * Traps Tab focus inside `container` while active, closes on Escape, and gives focus back to whatever had it
 * before the modal opened. Focus moves to the container itself (so screen readers announce the dialog) unless
 * something inside already took it, e.g. an input with `autoFocus`. Nested modals stack: only the top one reacts.
 */
export function useFocusTrap(container: RefObject<HTMLElement>, isActive: boolean, onEscape?: () => void): void {
  // Captured during the first render, before children with autoFocus move focus inside.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const element = container.current;
    if (!isActive || !element) return;

    const token = {};
    modalStack.push(token);
    if (!element.contains(document.activeElement)) element.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (event.key === 'Escape' && onEscapeRef.current) {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = focusablesIn(element);
      const active = document.activeElement;
      if (focusables.length === 0) {
        event.preventDefault();
        element.focus();
      } else if (event.shiftKey && (active === focusables[0] || active === element || !element.contains(active))) {
        event.preventDefault();
        focusables[focusables.length - 1].focus();
      } else if (!event.shiftKey && (active === focusables[focusables.length - 1] || !element.contains(active))) {
        event.preventDefault();
        focusables[0].focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      modalStack.splice(modalStack.indexOf(token), 1);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [container, isActive, opener]);
}

let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

/** Stops the page behind a modal from scrolling and hides it from assistive technology. Returns the undo. */
export function lockPage(): () => void {
  const root = document.documentElement;
  const app = document.getElementById('root');
  if (lockCount === 0) {
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    savedOverflow = root.style.overflow;
    savedPaddingRight = root.style.paddingRight;
    root.style.overflow = 'hidden';
    if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`;
    if (app) app.inert = true;
  }
  lockCount += 1;

  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    lockCount -= 1;
    if (lockCount > 0) return;
    root.style.overflow = savedOverflow;
    root.style.paddingRight = savedPaddingRight;
    if (app) app.inert = false;
  };
}
