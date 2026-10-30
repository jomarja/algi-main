import { useMemo } from 'react';
import { DestinationView, cx } from '../../design/index.ts';
import { GOAL_ICON_META, isDestination } from '../../engine/index.ts';
import type { Journey } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { Pinned, RingedAvatar, Road, Traveller } from './JourneyRoad.tsx';
import { journeyPath, pointAt } from './journeyPath.ts';
import { useElementWidth } from './useElementWidth.ts';

const STRIP_HEIGHT = 92;

/** Compact horizontal journey for the Home dashboard (JourneyMapView.swift `JourneyStrip`). */
export function JourneyStrip({ journey }: { journey: Journey }) {
  const display = useDisplay();
  const [container, width] = useElementWidth<HTMLDivElement>();

  return (
    <div
      ref={container}
      role="img"
      aria-label={journey.accessibilitySummary(display)}
      className="relative w-full"
      style={{ height: STRIP_HEIGHT }}
    >
      {width > 0 && <StripContent journey={journey} width={width} />}
    </div>
  );
}

function StripContent({ journey, width }: { journey: Journey; width: number }) {
  const path = useMemo(() => journeyPath(width, STRIP_HEIGHT, 'horizontal'), [width]);
  const luka = pointAt(path, journey.progress);
  const checkpoints = journey.milestones.filter((milestone) => !isDestination(milestone));

  return (
    <>
      <Road path={path} width={width} height={STRIP_HEIGHT} roadWidth={16} progressWidth={6} progress={journey.progress} />
      {checkpoints.map((milestone) => (
        <Pinned key={milestone.index} point={pointAt(path, milestone.fraction)}>
          <span
            className={cx(
              'block h-[11px] w-[11px] rounded-full border-2 transition-colors duration-300',
              milestone.state === 'reached' ? 'bg-mintDark' : 'bg-surface',
              milestone.state === 'current' ? 'border-amber' : 'border-line',
            )}
          />
        </Pinned>
      ))}
      <Pinned point={{ x: width - 42, y: STRIP_HEIGHT / 2 - 4 }}>
        <DestinationView destination={GOAL_ICON_META[journey.goal.icon].destination} className="block h-[60px] w-[78px]" />
      </Pinned>
      <Traveller point={{ x: luka.x, y: luka.y - 14 }}>
        <RingedAvatar
          size={36}
          ringWidth={3}
          shadow="0 2px 8px rgba(22, 60, 53, 0.15)"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
      </Traveller>
    </>
  );
}
