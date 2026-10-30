import type { CoachAction } from '../../../../shared/coach.ts';
import { majorUnits, resolveText, type AppLanguage, type CoachDestination } from '../../../engine/index.ts';
import { buildPath } from '../../../layout/router/matchPath.ts';

export const RECOMMENDATIONS_PATH = '/coach/recommendations';

/** AI suggestions live in the same list as the app's own; their detail URLs carry this prefix to tell them apart. */
const AI_ID_PREFIX = 'ai-';

export type RecommendationRef = { readonly source: 'local' | 'ai'; readonly id: string };

export function recommendationPath(ref: RecommendationRef): string {
  const param = ref.source === 'ai' ? AI_ID_PREFIX + ref.id : ref.id;
  return buildPath(`${RECOMMENDATIONS_PATH}/:recommendationId`, { recommendationId: param });
}

/** Reads `:recommendationId` back into the suggestion it names. */
export function parseRecommendationParam(param: string): RecommendationRef {
  return param.startsWith(AI_ID_PREFIX) ? { source: 'ai', id: param.slice(AI_ID_PREFIX.length) } : { source: 'local', id: param };
}

const actionPaths: Readonly<Record<CoachAction, string | null>> = {
  review_budget: '/plan/budget',
  plan_goal: '/plan/goal-planner',
  compare_loan: '/plan/loans',
  what_if: '/plan/what-if',
  open_transactions: '/transactions',
  none: null,
};

/** The screen an AI suggestion's button opens; null when it needs no action. */
export function coachActionPath(action: CoachAction): string | null {
  return actionPaths[action];
}

/**
 * The screen a local suggestion's next step opens (iOS PlanRoute / InsightKind). A goal re-plan prefills the
 * planner through its query (`name`, `target` in lari, and `goalId` of the goal being re-planned).
 */
export function coachDestinationPath(destination: CoachDestination, language: AppLanguage): string {
  switch (destination.kind) {
    case 'goalPlanner': {
      const { request } = destination;
      if (!request) return '/plan/goal-planner';
      const query = new URLSearchParams();
      if (request.name) query.set('name', resolveText(request.name, language));
      query.set('target', String(majorUnits(request.target)));
      if (request.goalId) query.set('goalId', request.goalId);
      return `/plan/goal-planner?${query.toString()}`;
    }
    case 'journey':
      return buildPath('/journey/:goalId', { goalId: destination.goalId });
    case 'budget':
      return '/plan/budget';
    case 'loanComparison':
      return '/plan/loans';
    case 'insight':
      return buildPath('/insights/:insightId', { insightId: destination.insight });
  }
}
