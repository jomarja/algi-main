import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../media.ts';
import { motion } from '../tokens.ts';
import { MascotView, PropView } from './MascotView.tsx';
import { flightKeyframes, landingPoint, leanAnchor, lobHeights, throwingHand, tossArtFrame, tossPieces, tossTiming } from './moneyToss.ts';
import type { Rect } from './moneyToss.ts';

interface MoneyTossOverlayProps {
  /** Luka's avatar tile on the page. Hide it while the overlay is mounted: the overlay draws an identical tile on top. */
  origin: RefObject<HTMLElement>;
  /** The balance figure the money flies into. */
  target: RefObject<HTMLElement>;
  /** Shown in an amber pill above the balance once the money lands, e.g. "+120.00 ₾". */
  amountText: string;
  /** The last piece has landed: show the new balance now. */
  onLanded?: () => void;
  /** The toss is over: unmount the overlay and show the page's own tile again. */
  onFinished?: () => void;
}

interface TossGeometry {
  tile: Rect;
  target: Rect;
}

interface TossElements {
  tile: HTMLElement;
  head: HTMLElement;
  rise: HTMLElement;
  lean: HTMLElement;
  pieces: HTMLElement[];
  pill: HTMLElement;
}

const { easing } = motion;
const milliseconds = (seconds: number) => seconds * 1000;
/** A moment of the toss as a keyframe offset. */
const at = (seconds: number) => seconds / tossTiming.total;

function documentRect(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height };
}

/** Starts every animation of one toss; returns them so they can be cancelled. */
function playToss(elements: TossElements, geometry: TossGeometry): Animation[] {
  const { sink, pop, hold, duck, launchDelay, stagger, flight, landing } = tossTiming;
  const duckStart = sink + pop + hold;
  const lowered = `translateY(${geometry.tile.height}px)`;
  const whole: KeyframeAnimationOptions = { duration: milliseconds(tossTiming.total), fill: 'both' };

  // His avatar head sinks out of the tile, stays down while he throws, and comes back up at the end.
  const head = elements.head.animate(
    [
      { offset: 0, transform: 'translateY(0%)', easing: easing.standard },
      { offset: at(sink), transform: 'translateY(100%)' },
      { offset: at(duckStart + duck), transform: 'translateY(100%)', easing: easing.out },
      { offset: 1, transform: 'translateY(0%)' },
    ],
    whole,
  );

  // Meanwhile he rises inside the tile in his throwing pose, holds, and sinks back.
  const rise = elements.rise.animate(
    [
      { offset: 0, transform: lowered },
      { offset: at(sink), transform: lowered, easing: easing.snappy },
      { offset: at(sink + pop), transform: 'translateY(0px)' },
      { offset: at(duckStart), transform: 'translateY(0px)', easing: easing.standard },
      { offset: at(duckStart + duck), transform: lowered },
      { offset: 1, transform: lowered },
    ],
    whole,
  );

  // Wind up, throw, settle.
  const lean = elements.lean.animate(
    [
      { offset: 0, transform: 'rotate(0deg)' },
      { offset: at(launchDelay - 0.15), transform: 'rotate(0deg)', easing: easing.standard },
      { offset: at(launchDelay), transform: 'rotate(-8deg)', easing: easing.snappy },
      { offset: at(launchDelay + 0.25), transform: 'rotate(6deg)', easing: easing.out },
      { offset: at(launchDelay + 0.85), transform: 'rotate(0deg)' },
      { offset: 1, transform: 'rotate(0deg)' },
    ],
    whole,
  );

  // The tile dips as he ducks and gives a small bump as the money leaves his hand.
  const tile = elements.tile.animate(
    [
      { offset: 0, transform: 'scale(1)', easing: easing.standard },
      { offset: at(sink), transform: 'scale(0.95)', easing: easing.out },
      { offset: at(sink + 0.3), transform: 'scale(1)' },
      { offset: at(launchDelay), transform: 'scale(1)', easing: easing.standard },
      { offset: at(launchDelay + 0.1), transform: 'scale(1.06)', easing: easing.out },
      { offset: at(launchDelay + 0.5), transform: 'scale(1)' },
      { offset: 1, transform: 'scale(1)' },
    ],
    whole,
  );

  const hand = throwingHand(geometry.tile);
  const pieces = elements.pieces.map((piece, index) =>
    piece.animate(
      flightKeyframes(
        tossPieces[index],
        hand,
        landingPoint(geometry.target, index, tossPieces.length),
        lobHeights[index % lobHeights.length],
      ),
      { duration: milliseconds(flight), delay: milliseconds(launchDelay + stagger * index), easing: 'linear', fill: 'both' },
    ),
  );

  // "+amount" pops up over the right end of the balance, lingers, and fades.
  const pillX = geometry.target.x + geometry.target.width - 20;
  const resting = `translate(${pillX}px, ${geometry.target.y - 4}px) translate(-50%, -50%) scale(0.6)`;
  const raised = `translate(${pillX}px, ${geometry.target.y - 22}px) translate(-50%, -50%) scale(1)`;
  const pillDuration = 1.05;
  const pill = elements.pill.animate(
    [
      { offset: 0, opacity: 0, transform: resting, easing: easing.bouncy },
      { offset: 0.4 / pillDuration, opacity: 1, transform: raised },
      { offset: 0.8 / pillDuration, opacity: 1, transform: raised, easing: easing.in },
      { offset: 1, opacity: 0, transform: resting },
    ],
    { duration: milliseconds(pillDuration), delay: milliseconds(landing), fill: 'both' },
  );

  return [head, rise, lean, tile, ...pieces, pill];
}

/**
 * Luka tosses coins and notes into the balance without leaving his avatar tile (MoneyTossOverlay.swift): his head
 * ducks out of view, he rises in his throwing pose, throws, then sinks back and his head returns. Only the money
 * leaves the tile. Mount it to start a toss, keep the page's tile hidden while it's mounted, update the balance in
 * `onLanded`, and unmount it in `onFinished`. With reduced motion it calls both right away and draws nothing.
 */
export function MoneyTossOverlay({ origin, target, amountText, onLanded, onFinished }: MoneyTossOverlayProps) {
  const reduceMotion = useReducedMotion();
  const [geometry, setGeometry] = useState<TossGeometry | 'unavailable' | null>(null);
  const callbacks = useRef({ onLanded, onFinished });
  useEffect(() => {
    callbacks.current = { onLanded, onFinished };
  });

  const tile = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const rise = useRef<HTMLDivElement>(null);
  const lean = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const pieces = useRef<Array<HTMLDivElement | null>>([]);

  useLayoutEffect(() => {
    const originElement = origin.current;
    const targetElement = target.current;
    setGeometry(originElement && targetElement ? { tile: documentRect(originElement), target: documentRect(targetElement) } : 'unavailable');
  }, [origin, target]);

  const canAnimate = !reduceMotion && geometry !== 'unavailable';

  useEffect(() => {
    if (canAnimate) return;
    callbacks.current.onLanded?.();
    callbacks.current.onFinished?.();
  }, [canAnimate]);

  // A layout effect, so the first painted frame is already the animation's first frame.
  useLayoutEffect(() => {
    if (!canAnimate || !geometry) return;
    if (!tile.current || !head.current || !rise.current || !lean.current || !pill.current) return;
    const animations = playToss(
      {
        tile: tile.current,
        head: head.current,
        rise: rise.current,
        lean: lean.current,
        pill: pill.current,
        pieces: pieces.current.filter((piece): piece is HTMLDivElement => piece !== null),
      },
      geometry,
    );
    const landed = window.setTimeout(() => callbacks.current.onLanded?.(), milliseconds(tossTiming.landing));
    const finished = window.setTimeout(() => callbacks.current.onFinished?.(), milliseconds(tossTiming.total));
    return () => {
      window.clearTimeout(landed);
      window.clearTimeout(finished);
      animations.forEach((animation) => animation.cancel());
    };
  }, [canAnimate, geometry]);

  if (!canAnimate || !geometry) return null;

  const art = tossArtFrame(geometry.tile);

  return createPortal(
    <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-40">
      <div
        ref={tile}
        className="absolute overflow-hidden rounded-lg bg-mintPale"
        style={{ left: geometry.tile.x, top: geometry.tile.y, width: geometry.tile.width, height: geometry.tile.height }}
      >
        <div ref={head} className="absolute inset-0">
          <MascotView pose="avatar" decorative className="h-full w-full" />
        </div>
        <div ref={rise} className="absolute" style={{ left: art.x, top: art.y, width: art.width, height: art.height }}>
          <div ref={lean} className="h-full w-full" style={{ transformOrigin: `${leanAnchor.x * 100}% ${leanAnchor.y * 100}%` }}>
            <MascotView pose="toss" decorative className="h-full w-full" />
          </div>
        </div>
      </div>
      {tossPieces.map((prop, index) => (
        <div
          key={index}
          ref={(element) => {
            pieces.current[index] = element;
          }}
          className="absolute left-0 top-0 opacity-0"
          style={{ width: prop === 'banknote' ? 42 : 28 }}
        >
          <PropView prop={prop} className="h-auto w-full" />
        </div>
      ))}
      <div ref={pill} className="type-headline absolute left-0 top-0 whitespace-nowrap rounded-full bg-amber px-3 py-1 text-ink opacity-0">
        {amountText}
      </div>
    </div>,
    document.body,
  );
}
