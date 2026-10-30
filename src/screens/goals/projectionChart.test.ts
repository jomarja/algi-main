import { describe, expect, it } from 'vitest';
import { addMonths, gel, GoalProjection, lt, REVISED_PLAN_EXTRA } from '../../engine/index.ts';
import type { SavingsGoal } from '../../engine/index.ts';
import { FIXTURE_NOW as now } from '../../engine/testFixtures.ts';
import { projectionChartRows, projectionTicks } from './projectionChart.ts';
import type { ProjectionRow } from './projectionChart.ts';

/** Three months to go, 400 ₾ a month. */
const goal: SavingsGoal = {
  id: 'laptop',
  name: lt('Laptop', 'ლეპტოპი'),
  icon: 'laptop',
  target: gel(2000),
  saved: gel(500),
  targetDate: addMonths(now, 3),
  monthlyContribution: gel(400),
  priority: 'medium',
};

describe('projectionChartRows', () => {
  const projection = new GoalProjection(goal, now);
  const rows = projectionChartRows(projection, projection.scenarios(REVISED_PLAN_EXTRA));

  it('has one row per month from today to the target date', () => {
    expect(rows.map((row) => row.time)).toEqual([now, addMonths(now, 1), addMonths(now, 2), addMonths(now, 3)].map((date) => date.getTime()));
  });

  it('puts every scenario on each row, in lari', () => {
    expect(rows[0]).toEqual({ time: now.getTime(), current: 500, conservative: 500, revised: 500 });
    expect(rows[1]).toEqual({ time: addMonths(now, 1).getTime(), current: 900, conservative: 800, revised: 980 });
  });

  it('ends with the projection at the target date', () => {
    const last = rows[rows.length - 1];
    expect(last.current).toBeCloseTo(500 + 400 * projection.monthsRemaining, 1);
  });
});

describe('projectionTicks', () => {
  const rowsOf = (count: number): ProjectionRow[] => Array.from({ length: count }, (_, index) => ({ time: index * 10 }));

  it('labels every row when there are few', () => {
    expect(projectionTicks(rowsOf(3))).toEqual([0, 10, 20]);
    expect(projectionTicks(rowsOf(4))).toEqual([0, 10, 20, 30]);
  });

  it('spaces labels evenly from the first row when there are many', () => {
    expect(projectionTicks(rowsOf(10))).toEqual([0, 30, 60, 90]);
    expect(projectionTicks(rowsOf(28))).toEqual([0, 90, 180, 270]);
  });

  it('respects a custom maximum', () => {
    expect(projectionTicks(rowsOf(9), 3)).toEqual([0, 40, 80]);
  });
});
