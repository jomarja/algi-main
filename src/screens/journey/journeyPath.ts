/**
 * The winding road of a journey (JourneyMapView.swift `JourneyPath`), sampled into points so positions can be
 * measured by distance along it. `pointAt` uses the same length-based fraction as the trimmed progress stroke,
 * so markers sit exactly on the drawn path.
 */

export type JourneyLayout = 'vertical' | 'horizontal';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface JourneyPath {
  readonly points: readonly Point[];
  /** Distance along the path to each point; the last one is the total length. */
  readonly lengths: readonly number[];
}

export const JOURNEY_PATH_SAMPLES = 90;
/** Vertical layout: room at the top for the destination artwork, and at the bottom for the start. */
const VERTICAL_TOP = 132;
const VERTICAL_BOTTOM_INSET = 40;
/** Horizontal layout: room at the right for the destination artwork. */
const HORIZONTAL_START = 22;
const HORIZONTAL_END_INSET = 92;

export function journeyPath(width: number, height: number, layout: JourneyLayout): JourneyPath {
  const points = Array.from({ length: JOURNEY_PATH_SAMPLES + 1 }, (_, step) =>
    samplePoint(step / JOURNEY_PATH_SAMPLES, width, height, layout),
  );
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    lengths.push(lengths[index - 1] + Math.hypot(points[index].x - previous.x, points[index].y - previous.y));
  }
  return { points, lengths };
}

function samplePoint(t: number, width: number, height: number, layout: JourneyLayout): Point {
  if (layout === 'vertical') {
    const bottom = height - VERTICAL_BOTTOM_INSET;
    return {
      x: width / 2 + width * 0.26 * Math.sin(t * Math.PI * 2.4),
      y: bottom - t * (bottom - VERTICAL_TOP),
    };
  }
  const end = width - HORIZONTAL_END_INSET;
  return {
    x: HORIZONTAL_START + t * (end - HORIZONTAL_START),
    y: height / 2 + height * 0.16 * Math.sin(t * Math.PI * 2),
  };
}

export function totalLength(path: JourneyPath): number {
  return path.lengths[path.lengths.length - 1] ?? 0;
}

export function pathEnd(path: JourneyPath): Point {
  return path.points[path.points.length - 1] ?? { x: 0, y: 0 };
}

/** The point a share of the way along the path, by distance; the share is clamped to 0…1. */
export function pointAt(path: JourneyPath, fraction: number): Point {
  const total = totalLength(path);
  const first = path.points[0];
  if (!first || total <= 0) return first ?? { x: 0, y: 0 };
  const target = Math.min(Math.max(fraction, 0), 1) * total;
  const upper = path.lengths.findIndex((length) => length >= target);
  if (upper <= 0) return first;
  const lower = upper - 1;
  const span = path.lengths[upper] - path.lengths[lower];
  const local = span > 0 ? (target - path.lengths[lower]) / span : 0;
  const from = path.points[lower];
  const to = path.points[upper];
  return { x: from.x + (to.x - from.x) * local, y: from.y + (to.y - from.y) * local };
}

/** SVG path data for the sampled road, rounded to hundredths of a pixel. */
export function svgPathData(path: JourneyPath): string {
  return path.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${rounded(point.x)} ${rounded(point.y)}`).join('');
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}
