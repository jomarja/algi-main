import { majorUnits, type GoalProjection, type GoalScenario, type ScenarioKind } from '../../engine/index.ts';

/** One date on the projection chart with each scenario's saved amount in lari. */
export type ProjectionRow = { readonly time: number } & Partial<Readonly<Record<ScenarioKind, number>>>;

/** Month-by-month checkpoints of every scenario, merged into chart rows by date (oldest first). */
export function projectionChartRows(projection: GoalProjection, scenarios: readonly GoalScenario[]): ProjectionRow[] {
  const rows = new Map<number, Partial<Record<ScenarioKind, number>>>();
  for (const scenario of scenarios) {
    for (const point of projection.checkpoints(scenario.monthlyContribution)) {
      const time = point.date.getTime();
      rows.set(time, { ...rows.get(time), [scenario.kind]: majorUnits(point.saved) });
    }
  }
  return [...rows].map(([time, values]) => ({ time, ...values })).sort((lhs, rhs) => lhs.time - rhs.time);
}

/** At most `maxCount` evenly spaced dates for the x-axis labels, starting with the first row. */
export function projectionTicks(rows: readonly ProjectionRow[], maxCount = 4): number[] {
  if (rows.length <= maxCount) return rows.map((row) => row.time);
  const step = Math.ceil((rows.length - 1) / (maxCount - 1));
  return rows.filter((_, index) => index % step === 0).map((row) => row.time);
}
