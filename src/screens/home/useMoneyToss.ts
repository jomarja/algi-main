import { useCallback, useEffect, useRef, useState } from 'react';
import { tossTiming, useReducedMotion } from '../../design/index.ts';
import type { Money } from '../../engine/index.ts';

interface Toss {
  readonly id: number;
  readonly amountText: string;
  /** Luka is on screen throwing; before this the pull-to-refresh space is still closing. */
  readonly isFlying: boolean;
}

export interface MoneyToss {
  readonly toss: Toss | null;
  /** What the balance card shows: the held figure while a refresh or toss is under way, otherwise `actual`. */
  shownBalance(actual: Money): Money;
  /** Before a refresh: keep `balance` on screen until the refresh settles, so the new figure never flashes early. */
  hold(balance: Money): void;
  /** The refresh raised the balance: Luka throws `amountText` into the held figure (HomeView.swift playToss). */
  throwIn(amountText: string): void;
  /** The refresh settled without a rise: show the real balance again. */
  release(): void;
  /** The last piece landed: show the new balance. */
  land(): void;
  /** The overlay is done: show the page's own tile again. */
  finish(): void;
}

/** Luka's money toss after a refresh raises the balance. With reduced motion the new balance simply appears. */
export function useMoneyToss(): MoneyToss {
  const reduceMotion = useReducedMotion();
  const [heldBalance, setHeldBalance] = useState<Money | null>(null);
  const [toss, setToss] = useState<Toss | null>(null);
  const startTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(startTimer.current), []);

  const hold = useCallback((balance: Money) => {
    // A toss still in the air keeps the older figure, so the balance never jumps part-way.
    setHeldBalance((current) => current ?? balance);
  }, []);

  const release = useCallback(() => setHeldBalance(null), []);

  const throwIn = useCallback(
    (amountText: string) => {
      if (reduceMotion) {
        setHeldBalance(null);
        return;
      }
      window.clearTimeout(startTimer.current);
      setToss({ id: Date.now(), amountText, isFlying: false });
      startTimer.current = window.setTimeout(() => {
        setToss((current) => current && { ...current, isFlying: true });
      }, tossTiming.startDelay * 1000);
    },
    [reduceMotion],
  );

  const land = useCallback(() => setHeldBalance(null), []);

  const finish = useCallback(() => setToss(null), []);

  const shownBalance = useCallback((actual: Money) => heldBalance ?? actual, [heldBalance]);

  return { toss, shownBalance, hold, throwIn, release, land, finish };
}
