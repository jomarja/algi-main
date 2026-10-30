import { buildPath } from '../../layout/router/matchPath.ts';

/** Where a goal's projection and details live. */
export function goalDetailPath(goalId: string): string {
  return buildPath('/goals/:goalId', { goalId });
}

/** One journey on its own screen. */
export function journeyDetailPath(goalId: string): string {
  return buildPath('/journey/:goalId', { goalId });
}

/** The Journey tab with a goal selected. */
export function journeyTabPath(goalId: string): string {
  return `/journey?${new URLSearchParams({ goal: goalId }).toString()}`;
}
