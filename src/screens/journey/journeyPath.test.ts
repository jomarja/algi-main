import { describe, expect, it } from 'vitest';
import { JOURNEY_PATH_SAMPLES, journeyPath, pathEnd, pointAt, svgPathData, totalLength } from './journeyPath.ts';

describe('journeyPath', () => {
  it('samples the road evenly in time', () => {
    const path = journeyPath(300, 520, 'vertical');
    expect(path.points).toHaveLength(JOURNEY_PATH_SAMPLES + 1);
    expect(path.lengths).toHaveLength(JOURNEY_PATH_SAMPLES + 1);
    expect(path.lengths[0]).toBe(0);
  });

  it('runs bottom to top in the vertical layout, leaving room for the destination', () => {
    const path = journeyPath(300, 520, 'vertical');
    expect(path.points[0]).toEqual({ x: 150, y: 480 });
    expect(pathEnd(path).y).toBeCloseTo(132);
    expect(pathEnd(path).x).toBeCloseTo(150 + 300 * 0.26 * Math.sin(Math.PI * 2.4));
  });

  it('runs left to right in the horizontal layout, leaving room for the destination', () => {
    const path = journeyPath(400, 92, 'horizontal');
    expect(path.points[0]).toEqual({ x: 22, y: 46 });
    expect(pathEnd(path).x).toBeCloseTo(308);
    expect(pathEnd(path).y).toBeCloseTo(46);
  });

  it('accumulates distances along the path', () => {
    const path = journeyPath(300, 520, 'vertical');
    for (let index = 1; index < path.lengths.length; index += 1) {
      expect(path.lengths[index]).toBeGreaterThan(path.lengths[index - 1]);
    }
    expect(totalLength(path)).toBe(path.lengths[JOURNEY_PATH_SAMPLES]);
  });
});

describe('pointAt', () => {
  // With no height the horizontal road is a straight line, so distance and x are proportional.
  const straight = journeyPath(192, 0, 'horizontal');

  it('measures by distance along the road', () => {
    expect(pointAt(straight, 0.5).x).toBeCloseTo(61);
    expect(pointAt(straight, 0.25).x).toBeCloseTo(41.5);
  });

  it('starts and ends at the road ends and clamps beyond them', () => {
    const path = journeyPath(300, 520, 'vertical');
    expect(pointAt(path, 0)).toEqual(path.points[0]);
    expect(pointAt(path, -1)).toEqual(path.points[0]);
    expect(pointAt(path, 1).x).toBeCloseTo(pathEnd(path).x);
    expect(pointAt(path, 1).y).toBeCloseTo(pathEnd(path).y);
    expect(pointAt(path, 2).y).toBeCloseTo(pathEnd(path).y);
  });

  it('stays at the start of a road without length', () => {
    // 114 px wide leaves no room between the start (22) and the destination inset (92).
    expect(pointAt(journeyPath(114, 0, 'horizontal'), 0.5)).toEqual({ x: 22, y: 0 });
  });
});

describe('svgPathData', () => {
  it('moves to the first point and draws lines through the rest', () => {
    const path = { points: [{ x: 0, y: 0 }, { x: 10.123, y: 5 }, { x: 20, y: 7.456 }], lengths: [0, 1, 2] };
    expect(svgPathData(path)).toBe('M0 0L10.12 5L20 7.46');
  });
});
