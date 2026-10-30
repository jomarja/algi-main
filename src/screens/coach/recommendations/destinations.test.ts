import { gel, goalRequest, lt } from '../../../engine/index.ts';
import { coachActionPath, coachDestinationPath, parseRecommendationParam, recommendationPath } from './destinations.ts';

describe('recommendation paths', () => {
  it('links local suggestions by their id', () => {
    expect(recommendationPath({ source: 'local', id: 'flexible-adjustment' })).toBe('/coach/recommendations/flexible-adjustment');
    expect(parseRecommendationParam('flexible-adjustment')).toEqual({ source: 'local', id: 'flexible-adjustment' });
  });

  it('marks AI suggestions so their ids never clash with local ones', () => {
    expect(recommendationPath({ source: 'ai', id: 'rec-1' })).toBe('/coach/recommendations/ai-rec-1');
    expect(parseRecommendationParam('ai-rec-1')).toEqual({ source: 'ai', id: 'rec-1' });
  });

  it('encodes ids that need it', () => {
    expect(recommendationPath({ source: 'local', id: 'goal-at-risk-a/b' })).toBe('/coach/recommendations/goal-at-risk-a%2Fb');
  });
});

describe('coachActionPath', () => {
  it('opens the screen each action names', () => {
    expect(coachActionPath('review_budget')).toBe('/plan/budget');
    expect(coachActionPath('plan_goal')).toBe('/plan/goal-planner');
    expect(coachActionPath('compare_loan')).toBe('/plan/loans');
    expect(coachActionPath('what_if')).toBe('/plan/what-if');
    expect(coachActionPath('open_transactions')).toBe('/transactions');
  });

  it('has no screen for good news', () => {
    expect(coachActionPath('none')).toBeNull();
  });
});

describe('coachDestinationPath', () => {
  it('prefills the goal planner for a re-plan', () => {
    const request = goalRequest('car', gel(4000), { name: lt('New car', 'ახალი მანქანა'), goalId: 'goal-1', alreadySaved: gel(500) });
    expect(coachDestinationPath({ kind: 'goalPlanner', request }, 'en')).toBe('/plan/goal-planner?name=New+car&target=4000&goalId=goal-1');
    expect(new URLSearchParams(coachDestinationPath({ kind: 'goalPlanner', request }, 'ka').split('?')[1]).get('name')).toBe('ახალი მანქანა');
  });

  it('opens an empty goal planner without a request', () => {
    expect(coachDestinationPath({ kind: 'goalPlanner', request: null }, 'en')).toBe('/plan/goal-planner');
  });

  it('opens the other screens', () => {
    expect(coachDestinationPath({ kind: 'journey', goalId: 'goal-1' }, 'en')).toBe('/journey/goal-1');
    expect(coachDestinationPath({ kind: 'budget' }, 'en')).toBe('/plan/budget');
    expect(coachDestinationPath({ kind: 'loanComparison' }, 'en')).toBe('/plan/loans');
    expect(coachDestinationPath({ kind: 'insight', insight: 'deliveryIncrease' }, 'en')).toBe('/insights/deliveryIncrease');
  });
});
