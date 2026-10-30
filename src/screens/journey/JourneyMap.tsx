import { useEffect, useMemo, useRef } from 'react';
import { DestinationView, Icon, cx, useReducedMotion } from '../../design/index.ts';
import { GOAL_ICON_META, isDestination } from '../../engine/index.ts';
import type { Journey, JourneyMilestone, MilestoneState } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { Pinned, RingedAvatar, Road, Traveller } from './JourneyRoad.tsx';
import { journeyPath, pathEnd, pointAt } from './journeyPath.ts';
import type { Point } from './journeyPath.ts';
import { useElementWidth } from './useElementWidth.ts';

const MAP_HEIGHT = 520;
/** Checkpoint amounts sit this far beside the road, on the side away from the centre. */
const LABEL_OFFSET = 58;

/** The full journey (JourneyMapView.swift): road from start to destination, checkpoints, and Luka at today's position. */
export function JourneyMap({ journey }: { journey: Journey }) {
  const display = useDisplay();
  const [container, width] = useElementWidth<HTMLDivElement>();

  return (
    <div
      ref={container}
      role="img"
      aria-label={journey.accessibilitySummary(display)}
      className="relative w-full rounded-xl bg-gradient-to-b from-mintPale to-cream"
      style={{ height: MAP_HEIGHT }}
    >
      {width > 0 && <MapContent journey={journey} width={width} />}
    </div>
  );
}

function MapContent({ journey, width }: { journey: Journey; width: number }) {
  const display = useDisplay();
  const path = useMemo(() => journeyPath(width, MAP_HEIGHT, 'vertical'), [width]);
  const end = pathEnd(path);
  const goal = journey.goal;
  const checkpoints = journey.milestones.filter((milestone) => !isDestination(milestone));

  return (
    <>
      <Scenery />
      <Road path={path} width={width} height={MAP_HEIGHT} roadWidth={28} progressWidth={10} progress={journey.progress} hasCenterLine />
      <Pinned point={pointAt(path, 0)}>
        <span className="type-caption block rounded-full border border-line bg-surface px-2 py-[3px] font-bold text-inkSoft">
          {display.t('Start', 'სტარტი')}
        </span>
      </Pinned>
      {checkpoints.map((milestone) => (
        <Checkpoint key={milestone.index} milestone={milestone} point={pointAt(path, milestone.fraction)} mapWidth={width} />
      ))}
      <Pinned point={{ x: end.x, y: end.y - 64 }}>
        <DestinationView destination={GOAL_ICON_META[goal.icon].destination} className="block h-[112px] w-[150px]" />
      </Pinned>
      <Pinned point={{ x: end.x, y: end.y - 4 }}>
        <span className="type-caption block whitespace-nowrap rounded-full bg-ink px-2 py-[3px] font-bold text-white">
          {display.money(goal.target, { precision: 'whole' })}
        </span>
      </Pinned>
      <Traveller point={pointAt(path, journey.progress)}>
        <LukaMarker message={journey.reaction(display).message} />
      </Traveller>
    </>
  );
}

/** Soft shapes behind the road, clipped to the map's rounded corners. */
function Scenery() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden rounded-xl">
      <span className="absolute h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.45]" style={{ left: '12%', top: '55%' }} />
      <span className="absolute h-[90px] w-[90px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.35]" style={{ left: '90%', top: '78%' }} />
      <span className="absolute h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/[0.18]" style={{ left: '86%', top: '34%' }} />
    </div>
  );
}

function Checkpoint({ milestone, point, mapWidth }: { milestone: JourneyMilestone; point: Point; mapWidth: number }) {
  const display = useDisplay();
  const labelX = point.x + (point.x > mapWidth / 2 ? -LABEL_OFFSET : LABEL_OFFSET);
  return (
    <>
      <Pinned point={point}>
        <MilestoneMarker state={milestone.state} />
      </Pinned>
      <Pinned point={{ x: labelX, y: point.y }}>
        <span
          className={cx(
            'type-caption block whitespace-nowrap font-semibold',
            milestone.state === 'upcoming' ? 'text-inkMuted' : 'text-ink',
          )}
        >
          {display.money(milestone.amount, { precision: 'whole' })}
        </span>
      </Pinned>
    </>
  );
}

const markerClasses: Record<MilestoneState, string> = {
  reached: 'border-2 border-mintDark bg-mint text-white',
  current: 'border-[3px] border-amber bg-surface text-amber',
  upcoming: 'border-2 border-line bg-surface',
};

function MilestoneMarker({ state }: { state: MilestoneState }) {
  return (
    <span className={cx('flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors duration-300', markerClasses[state])}>
      {state === 'reached' && <Icon name="checkmark" size={12} />}
      {state === 'current' && <Icon name="star.fill" size={11} />}
    </span>
  );
}

/** Luka's reaction in a bubble over his avatar, gently bobbing unless Reduce Motion is on. */
function LukaMarker({ message }: { message: string }) {
  const reduceMotion = useReducedMotion();
  const bobbing = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = bobbing.current;
    if (reduceMotion || !element) return;
    const animation = element.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }], {
      duration: 1300,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out',
    });
    return () => animation.cancel();
  }, [reduceMotion]);

  return (
    <div ref={bobbing}>
      <div className="flex flex-col items-center gap-1" style={{ transform: 'translate(-50%, calc(-50% - 38px))' }}>
        <p className="type-caption w-max max-w-[194px] rounded-sm bg-surface px-3 py-2 text-center font-semibold text-ink shadow-[0_2px_12px_rgba(22,60,53,0.08)]">
          {message}
        </p>
        <RingedAvatar size={56} ringWidth={4} shadow="0 4px 16px rgba(22, 60, 53, 0.18)" />
      </div>
    </div>
  );
}
