import { useRef } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../cx.ts';
import { useReducedMotion } from '../media.ts';
import { usePlayOnChange } from '../motion.ts';
import { motion } from '../tokens.ts';

/** Each card bobs at its own pace so neighbours drift out of step. */
const bobPeriods = [3.2, 2.6, 3.0, 2.8];

/** A quick hop with squash and stretch, anchored at the bottom. */
const hopKeyframes: Keyframe[] = [
  { offset: 0, transform: 'translateY(0) scale(1, 1)', easing: motion.easing.out },
  { offset: 0.22, transform: 'translateY(-12px) scale(0.96, 1.04)', easing: motion.easing.out },
  { offset: 0.41, transform: 'translateY(-7px) scale(1.04, 0.96)', easing: motion.easing.bouncy },
  { offset: 1, transform: 'translateY(0) scale(1, 1)' },
];
const hopOptions: KeyframeAnimationOptions = { duration: 640 };

/** A "no" shake, as when a field fails validation. */
const shakeKeyframes: Keyframe[] = [
  { offset: 0, transform: 'translateX(0)' },
  { offset: 0.11, transform: 'translateX(-10px)' },
  { offset: 0.26, transform: 'translateX(9px)' },
  { offset: 0.41, transform: 'translateX(-6px)' },
  { offset: 0.54, transform: 'translateX(4px)', easing: motion.easing.out },
  { offset: 1, transform: 'translateX(0)' },
];
const shakeOptions: KeyframeAnimationOptions = { duration: 540 };

interface FloatingOnCoinsProps {
  /** Position among the floating cards; picks the bob period. */
  index: number;
  /** Change it (e.g. increment on focus) to make the card hop. */
  hopTrigger?: number;
  /** Change it (e.g. increment on a failed submit) to shake the card. */
  shakeTrigger?: number;
  isActive?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Makes a card bob gently as if it floats on the coins, hop when `hopTrigger` changes, and shake when
 * `shakeTrigger` changes (FloatingOnCoins in PersonalInfoView.swift). Still when reduced motion is on.
 */
export function FloatingOnCoins({ index, hopTrigger = 0, shakeTrigger = 0, isActive = true, className, children }: FloatingOnCoinsProps) {
  const reduceMotion = useReducedMotion();
  const moves = isActive && !reduceMotion;
  const hop = useRef<HTMLDivElement>(null);
  const shake = useRef<HTMLDivElement>(null);
  usePlayOnChange(hop, hopTrigger, moves, hopKeyframes, hopOptions);
  usePlayOnChange(shake, shakeTrigger, moves, shakeKeyframes, shakeOptions);

  return (
    <div
      className={cx(moves && 'animate-coin-bob', className)}
      style={moves ? { animationDuration: `${bobPeriods[index % bobPeriods.length]}s` } : undefined}
    >
      <div ref={hop} className="origin-bottom">
        <div ref={shake}>{children}</div>
      </div>
    </div>
  );
}
