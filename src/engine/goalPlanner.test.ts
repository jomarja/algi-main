import { describe, expect, it } from 'vitest';
import { createDisplay } from './display.ts';
import {
  estimateOwnershipCosts,
  goalRequest,
  GoalPlanner,
  GoalRequestParser,
  ownershipMonthlyTotal,
  planRisks,
  replanningRequest,
  targetStepSize,
} from './goalPlanner.ts';
import { gel } from './money.ts';
import { FIXTURE_NOW as now, sampleBudget, sampleGoals } from './testFixtures.ts';

const planner = new GoalPlanner(sampleBudget(), now);

describe('GoalRequestParser', () => {
  it('understands a car goal', () => {
    const request = GoalRequestParser.parse('I want to buy a car worth 15,000 ₾');
    expect(request?.kind).toBe('car');
    expect(request?.target).toEqual(gel(15000));
    expect(request?.months).toBeNull();
  });

  it('understands Georgian with a deadline', () => {
    const request = GoalRequestParser.parse('დასვენება ბათუმში 1 500 ₾ 5 თვეში');
    expect(request?.kind).toBe('holiday');
    expect(request?.target).toEqual(gel(1500));
    expect(request?.months).toBe(5);
  });

  it('converts years to months', () => {
    const request = GoalRequestParser.parse('Emergency fund 4000 in 2 years');
    expect(request?.kind).toBe('emergencyFund');
    expect(request?.target).toEqual(gel(4000));
    expect(request?.months).toBe(24);
  });

  it('reads shorthand thousands', () => {
    const request = GoalRequestParser.parse('15k for a new laptop');
    expect(request?.kind).toBe('purchase');
    expect(request?.target).toEqual(gel(15000));
  });

  it('needs an amount', () => {
    expect(GoalRequestParser.parse('I want a car')).toBeNull();
  });
});

describe('GoalPlanner', () => {
  it('offers three paces from the budget', () => {
    expect(planner.maximumMonthly).toEqual(gel(545));
    expect(planner.balancedMonthly).toEqual(gel(370));
    expect(planner.flexibleMonthly).toEqual(gel(185));
  });

  it('plans a car including one-off costs', () => {
    const request = goalRequest('car', gel(15000));
    expect(planner.amountToSave(request)).toEqual(gel(15250));

    const plans = planner.plans(request);
    expect(plans.map((plan) => plan.pace)).toEqual(['faster', 'balanced', 'flexible']);
    expect(plans.map((plan) => plan.months)).toEqual([28, 42, 83]);
    expect(plans.map((plan) => plan.affordability)).toEqual(['tight', 'comfortable', 'comfortable']);
    expect(plans[0].flexibleAfter).toEqual(gel(236.56));
  });

  it('shows where the money comes from without touching essentials', () => {
    const plans = planner.plans(goalRequest('car', gel(15000)));
    expect(plans[0].adjustments.map((cut) => cut.category)).toEqual(['foodAndDrink', 'foodDelivery', 'shopping', 'subscriptions']);
    expect(plans[1].adjustments.map((cut) => cut.category)).toEqual(['foodAndDrink']);
    expect(plans[2].adjustments).toEqual([]);
  });

  it('separates ownership costs from the price', () => {
    const costs = estimateOwnershipCosts('car', gel(15000));
    expect(costs?.insurancePerMonth).toEqual(gel(50));
    expect(costs?.maintenancePerMonth).toEqual(gel(12.5));
    expect(costs && ownershipMonthlyTotal(costs)).toEqual(gel(182.5));
    expect(estimateOwnershipCosts('holiday', gel(1500))).toBeNull();
  });

  it('accepts a realistic deadline', () => {
    const feasibility = planner.feasibility(goalRequest('holiday', gel(1500)), 5);
    expect(feasibility.kind).toBe('feasible');
    if (feasibility.kind !== 'feasible') return;
    expect(feasibility.plan.monthlySaving).toEqual(gel(300));
    expect(feasibility.plan.affordability).toBe('comfortable');
  });

  it('offers alternatives for an unrealistic deadline', () => {
    const feasibility = planner.feasibility(goalRequest('car', gel(15000)), 12);
    expect(feasibility).toEqual({
      kind: 'notFeasible',
      requiredMonthly: gel(1270.84),
      maximumMonthly: gel(545),
      soonestMonths: 28,
      reachableByDeadline: gel(6540),
    });
  });

  it('flags a custom amount above the sustainable maximum', () => {
    expect(planner.customPlan(goalRequest('holiday', gel(1500)), gel(600)).affordability).toBe('notAffordable');
  });

  it('replans an existing goal with its own contribution freed', () => {
    const goal = sampleGoals()[0];
    const request = replanningRequest(goal, now);
    expect(request.goalId).toBe(goal.id);
    expect(request.months).toBe(2);

    const freed = new GoalPlanner(sampleBudget(gel(550)), now);
    expect(freed.amountToSave(request)).toEqual(gel(1350));
    expect(freed.feasibility(request, 2).kind).toBe('feasible');
  });

  it('lists the honest caveats of a plan', () => {
    const request = goalRequest('car', gel(15000));
    const [faster, balanced, flexible] = planner.plans(request);
    const display = createDisplay('en');
    expect(planRisks(faster, request, display)[0]).toContain('Little room for surprises');
    expect(planRisks(balanced, request, display)).toHaveLength(3);
    expect(planRisks(flexible, request, display)).toContain('Takes over 3 years — prices may change by then.');
    expect(planRisks(balanced, request, display).at(-1)).toContain('183');
  });

  it('steps bigger targets in bigger increments', () => {
    expect(targetStepSize(9_999)).toBe(100);
    expect(targetStepSize(10_000)).toBe(500);
  });
});
