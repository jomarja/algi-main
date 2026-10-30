import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../media.ts';
import { palette } from '../tokens.ts';

const colors = [palette.coral, palette.amber, palette.mint, palette.lavender];
const pieceCount = 28;

/**
 * A short shower of confetti for milestones (MilestoneCelebrationView.swift). Fills its positioned parent and
 * plays each time `isActive` turns on. Skipped entirely with reduced motion.
 */
export function ConfettiBurst({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!isActive || !element) return;
    const { clientWidth: width, clientHeight: height } = element;
    const animations = Array.from(element.children).map((piece, index) => {
      const x = (width * index) / pieceCount + (index % 3) * 9;
      const landingY = height * (0.55 + (index % 5) * 0.09);
      const turn = ((index * 47) % 360) + 360;
      return piece.animate(
        [
          { transform: `translate(${x}px, -20px) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${x}px, ${landingY}px) rotate(${turn}deg)`, opacity: 0 },
        ],
        {
          duration: (1.6 + (index % 4) * 0.25) * 1000,
          delay: (index % 6) * 50,
          easing: 'ease-in',
          fill: 'both',
        },
      );
    });
    return () => animations.forEach((animation) => animation.cancel());
  }, [isActive, reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div ref={container} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: pieceCount }, (_, index) => (
        <span
          key={index}
          className="absolute left-0 top-0 h-[14px] w-2 -translate-y-6 rounded-[2px]"
          style={{ backgroundColor: colors[index % colors.length] }}
        />
      ))}
    </div>
  );
}
