import {
  GOAL_KINDS,
  goalRequest,
  GoalRequestParser,
  lt,
  majorUnits,
  parseMoney,
  replanningRequest,
  type GoalKind,
  type GoalRequest,
  type SavingsGoal,
} from '../../../engine/index.ts';

export const GOAL_PLANNER_PATH = '/plan/goal-planner';

/**
 * The planner's URL for a request (iOS `PlanRoute.goalPlanner(request)`): re-planning an existing goal links by
 * its id; a new goal carries its kind, target and deadline. The name isn't carried because it is localized.
 */
export function goalPlannerPath(request: GoalRequest | null = null): string {
  if (!request) return GOAL_PLANNER_PATH;
  const query = new URLSearchParams();
  if (request.goalId) {
    query.set('goal', request.goalId);
  } else {
    query.set('kind', request.kind);
    query.set('target', String(majorUnits(request.target)));
    if (request.months !== null) query.set('months', String(request.months));
  }
  return `${GOAL_PLANNER_PATH}?${query.toString()}`;
}

/**
 * Reads a prefilled request from the planner's URL: `?goal=<id>` (or `goalId`, as the coach links) re-plans that goal
 * toward its target date; `?target=…` (with optional `kind`, `name` and `months`) starts a new one. Null when there's
 * nothing usable.
 */
export function plannerRequestFromQuery(query: URLSearchParams, goals: readonly SavingsGoal[], now: Date): GoalRequest | null {
  const goalId = query.get('goal') ?? query.get('goalId');
  if (goalId !== null) {
    const goal = goals.find((candidate) => candidate.id === goalId);
    return goal ? replanningRequest(goal, now) : null;
  }

  const target = parseMoney(query.get('target') ?? '', 'GEL');
  if (!target || target.minorUnits <= 0) return null;
  const name = query.get('name')?.trim() || null;
  return goalRequest(kindFrom(query.get('kind'), name), target, {
    months: positiveWholeNumber(query.get('months')),
    name: name ? lt(name, name) : null,
  });
}

function kindFrom(value: string | null, name: string | null): GoalKind {
  return GOAL_KINDS.find((kind) => kind === value) ?? GoalRequestParser.kind((name ?? '').toLowerCase());
}

function positiveWholeNumber(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number > 0 ? number : null;
}
