/**
 * A smooth line through `values`, scaled to fill width × height (TrendWave.swift): each segment is a cubic
 * curve whose control points share the midpoint's x, so the line eases between points without overshooting.
 */
export function trendWavePath(values: readonly number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => ({
    x: index * step,
    y: height - ((value - minValue) / range) * height,
  }));

  const round = (value: number) => Math.round(value * 100) / 100;
  let path = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = round((previous.x + current.x) / 2);
    path += `C${midX} ${round(previous.y)} ${midX} ${round(current.y)} ${round(current.x)} ${round(current.y)}`;
  }
  return path;
}
