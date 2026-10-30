import {
  estimateOwnershipCosts,
  majorUnits,
  ownershipMonthlyTotal,
  subtract,
  type GoalPlanner,
  type GoalRequest,
  type Money,
  type MonthlyBudget,
  type OwnershipCosts,
} from '../../../engine/index.ts';

/** The target stepper's range in lari (GoalPlannerView.swift). */
export const TARGET_RANGE = { min: 100, max: 200_000 } as const;
/** Deadline stepper in months; 0 means no deadline. */
export const DEADLINE_RANGE = { min: 0, max: 120 } as const;
/** The custom monthly amount slider starts here and moves in these steps. */
export const CUSTOM_MONTHLY_MIN = 20;
export const CUSTOM_MONTHLY_STEP = 5;

/** The slider goes past the maximum so the user can see why more isn't realistic; never below 100 ₾. */
export function customMonthlyMax(planner: GoalPlanner): number {
  return Math.max(majorUnits(planner.maximumMonthly) * 1.5, 100);
}

export interface OwnershipSummary {
  readonly costs: OwnershipCosts;
  readonly monthlyTotal: Money;
  /** Flexible money each month today. */
  readonly flexible: Money;
  /** Flexible money each month once owning it is paid for. */
  readonly afterPurchase: Money;
}

/** What owning the goal would cost each month and what that leaves; null for goals without running costs. */
export function ownershipSummary(request: GoalRequest, budget: MonthlyBudget): OwnershipSummary | null {
  const costs = estimateOwnershipCosts(request.kind, request.target);
  if (!costs) return null;
  const monthlyTotal = ownershipMonthlyTotal(costs);
  const flexible = budget.flexibleAllowance;
  return { costs, monthlyTotal, flexible, afterPurchase: subtract(flexible, monthlyTotal) };
}
