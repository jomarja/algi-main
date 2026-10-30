import { describe, expect, it } from 'vitest';
import { gel, goalRequest, lt, replanningRequest } from '../../../engine/index.ts';
import { FIXTURE_NOW as now, sampleGoals } from '../../../engine/testFixtures.ts';
import { GOAL_PLANNER_PATH, goalPlannerPath, plannerRequestFromQuery } from './plannerQuery.ts';

const goals = sampleGoals();

function parse(search: string) {
  return plannerRequestFromQuery(new URLSearchParams(search), goals, now);
}

describe('goalPlannerPath', () => {
  it('is the bare planner without a request', () => {
    expect(goalPlannerPath()).toBe(GOAL_PLANNER_PATH);
    expect(goalPlannerPath(null)).toBe(GOAL_PLANNER_PATH);
  });

  it('links a re-plan by goal id', () => {
    const request = replanningRequest(goals[0], now);
    expect(goalPlannerPath(request)).toBe(`/plan/goal-planner?goal=${goals[0].id}`);
  });

  it('carries the kind, target and deadline of a new goal', () => {
    expect(goalPlannerPath(goalRequest('car', gel(15000), { months: 24 }))).toBe(
      '/plan/goal-planner?kind=car&target=15000&months=24',
    );
    expect(goalPlannerPath(goalRequest('holiday', gel(1500.5)))).toBe('/plan/goal-planner?kind=holiday&target=1500.5');
  });
});

describe('plannerRequestFromQuery', () => {
  it('re-plans an existing goal toward its target date', () => {
    expect(parse(`goal=${goals[1].id}`)).toEqual(replanningRequest(goals[1], now));
  });

  it('accepts the goalId parameter the coach links with', () => {
    expect(parse(`name=Safety cushion&target=4000&goalId=${goals[0].id}`)).toEqual(replanningRequest(goals[0], now));
  });

  it('ignores an unknown goal', () => {
    expect(parse('goal=missing')).toBeNull();
  });

  it('starts a new goal from a target, kind and deadline', () => {
    expect(parse('kind=car&target=15000&months=24')).toEqual(goalRequest('car', gel(15000), { months: 24 }));
  });

  it('infers the kind from the name and keeps the name', () => {
    expect(parse('name=Holiday in Batumi&target=1500')).toEqual(
      goalRequest('holiday', gel(1500), { name: lt('Holiday in Batumi', 'Holiday in Batumi') }),
    );
  });

  it('falls back to a big purchase for an unknown kind', () => {
    expect(parse('kind=boat&target=900')?.kind).toBe('purchase');
  });

  it('needs a positive target', () => {
    expect(parse('')).toBeNull();
    expect(parse('target=0')).toBeNull();
    expect(parse('target=abc')).toBeNull();
  });

  it('drops a deadline that is not a positive whole number', () => {
    expect(parse('target=1000&months=0')?.months).toBeNull();
    expect(parse('target=1000&months=2.5')?.months).toBeNull();
    expect(parse('target=1000&months=-3')?.months).toBeNull();
  });

  it('round-trips the paths it builds', () => {
    const request = goalRequest('home', gel(20000), { months: 36 });
    const search = goalPlannerPath(request).split('?')[1];
    expect(parse(search)).toEqual(request);
  });
});
