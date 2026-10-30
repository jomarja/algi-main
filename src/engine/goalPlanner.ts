import { addMonths, WEEKS_PER_MONTH } from './calendar.ts';
import type { Display } from './display.ts';
import { lt, type LocalizedText } from './localization.ts';
import {
  add,
  compare,
  divide,
  fromMinorUnits,
  gel,
  MAXIMUM_PARSABLE_AMOUNT,
  maxMoney,
  minMoney,
  multiply,
  roundedToMultiple,
  subtract,
  sum,
  zero,
  type Money,
} from './money.ts';
import type { CutSuggestion, MonthlyBudget } from './monthlyBudget.ts';
import type { TagTone } from './presentation.ts';
import { round } from './rounding.ts';
import { GoalProjection, type GoalIcon, type SavingsGoal } from './savingsGoal.ts';

export type GoalKind = 'car' | 'home' | 'holiday' | 'emergencyFund' | 'loanPayoff' | 'purchase';

export const GOAL_KINDS: readonly GoalKind[] = ['car', 'home', 'holiday', 'emergencyFund', 'loanPayoff', 'purchase'];

export const GOAL_KIND_META: Readonly<Record<GoalKind, { readonly title: LocalizedText; readonly icon: GoalIcon }>> = {
  car: { title: lt('New car', 'ახალი მანქანა'), icon: 'car' },
  home: { title: lt('Apartment', 'ბინა'), icon: 'home' },
  holiday: { title: lt('Holiday', 'დასვენება'), icon: 'travel' },
  emergencyFund: { title: lt('Emergency fund', 'სარეზერვო ფონდი'), icon: 'shield' },
  loanPayoff: { title: lt('Loan-free', 'სესხის გარეშე'), icon: 'loan' },
  purchase: { title: lt('Big purchase', 'დიდი შენაძენი'), icon: 'gift' },
};

const ICON_GOAL_KINDS: Readonly<Record<GoalIcon, GoalKind>> = {
  shield: 'emergencyFund',
  home: 'home',
  travel: 'holiday',
  car: 'car',
  laptop: 'purchase',
  gift: 'purchase',
  loan: 'loanPayoff',
};

export function goalKindForIcon(icon: GoalIcon): GoalKind {
  return ICON_GOAL_KINDS[icon];
}

/** A goal as the user described it. */
export interface GoalRequest {
  readonly kind: GoalKind;
  readonly target: Money;
  /** A deadline the user mentioned, if any. */
  readonly months: number | null;
  readonly alreadySaved: Money;
  readonly name: LocalizedText | null;
  /** Set when re-planning an existing goal rather than starting a new one. */
  readonly goalId: string | null;
}

export function goalRequest(
  kind: GoalKind,
  target: Money,
  options: Partial<Omit<GoalRequest, 'kind' | 'target'>> = {},
): GoalRequest {
  return {
    kind,
    target,
    months: options.months ?? null,
    alreadySaved: options.alreadySaved ?? zero('GEL'),
    name: options.name ?? null,
    goalId: options.goalId ?? null,
  };
}

export function goalRequestDisplayName(request: GoalRequest): LocalizedText {
  return request.name ?? GOAL_KIND_META[request.kind].title;
}

/** Re-plans an existing goal toward its current target date. */
export function replanningRequest(goal: SavingsGoal, now: Date): GoalRequest {
  const projection = new GoalProjection(goal, now);
  return goalRequest(goalKindForIcon(goal.icon), goal.target, {
    months: Math.max(round(projection.monthsRemaining), 1),
    alreadySaved: goal.saved,
    name: goal.name,
    goalId: goal.id,
  });
}

const KEYWORDS: readonly (readonly [GoalKind, readonly string[]])[] = [
  ['car', ['car', 'vehicle', 'მანქან', 'ავტომობილ']],
  ['home', ['apartment', 'flat', 'house', 'home', 'ბინა', 'სახლ']],
  ['holiday', ['holiday', 'vacation', 'trip', 'travel', 'დასვენ', 'მოგზაურ']],
  ['emergencyFund', ['emergency', 'cushion', 'safety', 'rainy', 'რეზერვ', 'ბალიშ']],
  ['loanPayoff', ['loan', 'debt', 'სესხ', 'ვალ']],
];

const DEADLINE_PATTERNS: readonly (readonly [RegExp, number])[] = [
  [/(\d+)\s*(months?|თვე\S*)/, 1],
  [/(\d+)\s*(years?|წელ\S*)/, 12],
];

const AMOUNT_PATTERN = /\d[\d\s, ]*(\.\d+)?\s*(k|კ)?/g;

/**
 * Understands simple goal sentences in English or Georgian, e.g. "I want to buy a car worth 15,000 ₾"
 * or "დასვენება 1500 ლარი 5 თვეში". Used when the AI coach is unavailable.
 */
function parseGoalRequest(text: string): GoalRequest | null {
  const lowered = text.toLowerCase();
  const { months, remainder } = extractMonths(lowered);
  const target = largestAmount(remainder);
  if (!target) return null;
  return goalRequest(goalKindIn(lowered), target, { months });
}

function goalKindIn(text: string): GoalKind {
  return KEYWORDS.find(([, words]) => words.some((word) => text.includes(word)))?.[0] ?? 'purchase';
}

export const GoalRequestParser = { parse: parseGoalRequest, kind: goalKindIn };

/** Finds "5 months", "2 years", "5 თვეში", "2 წელში" and returns months plus the text without that phrase. */
function extractMonths(text: string): { months: number | null; remainder: string } {
  for (const [pattern, multiplier] of DEADLINE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const remainder = text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length);
    return { months: Number(match[1]) * multiplier, remainder };
  }
  return { months: null, remainder: text };
}

/** The largest number in the text, accepting "15,000", "15 000", "15000", "1500.50", and "15k". */
function largestAmount(text: string): Money | null {
  const values = [...text.matchAll(AMOUNT_PATTERN)].flatMap((match) => {
    const token = match[0].trim();
    const isThousands = token.endsWith('k') || token.endsWith('კ');
    const value = Number(token.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(value)) return [];
    return [isThousands ? value * 1000 : value];
  });
  if (values.length === 0) return null;
  const largest = Math.max(...values);
  if (largest <= 0 || largest > MAXIMUM_PARSABLE_AMOUNT) return null;
  return gel(largest);
}

/** Illustrative costs of owning a car, kept separate from the purchase price. */
export interface OwnershipCosts {
  readonly insurancePerMonth: Money;
  readonly fuelPerMonth: Money;
  readonly maintenancePerMonth: Money;
  readonly registrationOnce: Money;
}

export const INSURANCE_SHARE_OF_PRICE_PER_YEAR = 0.04;
export const MAINTENANCE_SHARE_OF_PRICE_PER_YEAR = 0.01;
export const FUEL_PER_MONTH = gel(120);
export const REGISTRATION_ONCE = gel(250);

export function estimateOwnershipCosts(kind: GoalKind, price: Money): OwnershipCosts | null {
  if (kind !== 'car') return null;
  return {
    insurancePerMonth: multiply(price, INSURANCE_SHARE_OF_PRICE_PER_YEAR / 12),
    fuelPerMonth: FUEL_PER_MONTH,
    maintenancePerMonth: multiply(price, MAINTENANCE_SHARE_OF_PRICE_PER_YEAR / 12),
    registrationOnce: REGISTRATION_ONCE,
  };
}

export function ownershipMonthlyTotal(costs: OwnershipCosts): Money {
  return add(add(costs.insurancePerMonth, costs.fuelPerMonth), costs.maintenancePerMonth);
}

export type GoalPace = 'faster' | 'balanced' | 'flexible' | 'custom';

export const GOAL_PACE_TITLES: Readonly<Record<GoalPace, LocalizedText>> = {
  faster: lt('Faster', 'სწრაფი'),
  balanced: lt('Balanced', 'დაბალანსებული'),
  flexible: lt('Flexible', 'მოქნილი'),
  custom: lt('Your plan', 'შენი გეგმა'),
};

export type Affordability = 'comfortable' | 'tight' | 'notAffordable';

export const AFFORDABILITY_META: Readonly<Record<Affordability, { readonly label: LocalizedText; readonly tone: TagTone }>> = {
  comfortable: { label: lt('Comfortable', 'კომფორტული'), tone: 'positive' },
  tight: { label: lt('Tight', 'მჭიდრო'), tone: 'attention' },
  notAffordable: { label: lt('Not realistic', 'არარეალისტური'), tone: 'attention' },
};

export interface GoalPlan {
  readonly pace: GoalPace;
  readonly monthlySaving: Money;
  readonly months: number;
  readonly completionDate: Date;
  /** Where the money comes from beyond unplanned room. Never includes essentials. */
  readonly adjustments: readonly CutSuggestion[];
  /** Flexible money left each month while the plan runs. */
  readonly flexibleAfter: Money;
  readonly affordability: Affordability;
}

export function weeklySaving(plan: GoalPlan): Money {
  return divide(plan.monthlySaving, WEEKS_PER_MONTH);
}

export type GoalFeasibility =
  | { readonly kind: 'feasible'; readonly plan: GoalPlan }
  /** The deadline needs more than can be saved without cutting essentials. */
  | {
      readonly kind: 'notFeasible';
      readonly requiredMonthly: Money;
      readonly maximumMonthly: Money;
      readonly soonestMonths: number;
      readonly reachableByDeadline: Money;
    };

export const FLEXIBLE_PACE_SHARE_OF_ROOM = 0.6;
export const LONG_PLAN_MONTHS = 36;

/**
 * Turns a goal into three honest ways to reach it, based on income, essentials (including debt),
 * existing savings commitments, and typical flexible spending. Every plan is an estimate.
 */
export class GoalPlanner {
  readonly budget: MonthlyBudget;
  readonly now: Date;

  constructor(budget: MonthlyBudget, now: Date) {
    this.budget = budget;
    this.now = now;
  }

  /** Saving faster than this would mean cutting more than half of flexible spending. */
  get maximumMonthly(): Money {
    return roundedToMultiple(this.budget.maximumSustainableSaving, 5, 'down');
  }

  get balancedMonthly(): Money {
    return roundedToMultiple(minMoney(this.gentleMonthly, this.budget.maximumSustainableSaving), 5, 'down');
  }

  get flexibleMonthly(): Money {
    return roundedToMultiple(multiply(this.budget.unplannedRoom, FLEXIBLE_PACE_SHARE_OF_ROOM), 5, 'down');
  }

  /** Amount to save: the target plus one-off ownership costs, minus what's already put aside. */
  amountToSave(request: GoalRequest): Money {
    const oneOff = estimateOwnershipCosts(request.kind, request.target)?.registrationOnce ?? zero('GEL');
    return maxMoney(subtract(add(request.target, oneOff), request.alreadySaved), zero('GEL'));
  }

  plans(request: GoalRequest): GoalPlan[] {
    const amount = this.amountToSave(request);
    return [
      this.plan('faster', amount, this.maximumMonthly),
      this.plan('balanced', amount, this.balancedMonthly),
      this.plan('flexible', amount, this.flexibleMonthly),
    ];
  }

  customPlan(request: GoalRequest, monthly: Money): GoalPlan {
    return this.plan('custom', this.amountToSave(request), monthly);
  }

  /** Checks a deadline and, if it isn't realistic, offers the closest realistic alternatives. */
  feasibility(request: GoalRequest, months: number): GoalFeasibility {
    const amount = this.amountToSave(request);
    const deadline = Math.max(months, 1);
    const required = fromMinorUnits(Math.ceil(amount.minorUnits / deadline), 'GEL');
    if (compare(required, this.budget.maximumSustainableSaving) <= 0) {
      return { kind: 'feasible', plan: this.plan('custom', amount, required) };
    }
    const maximum = this.maximumMonthly;
    return {
      kind: 'notFeasible',
      requiredMonthly: required,
      maximumMonthly: maximum,
      soonestMonths: maximum.minorUnits > 0 ? Math.ceil(amount.minorUnits / maximum.minorUnits) : 0,
      reachableByDeadline: multiply(maximum, deadline),
    };
  }

  /** Unplanned room plus the gentle adjustment: what fits without real sacrifices. */
  private get gentleMonthly(): Money {
    const gentle = sum(this.budget.gentleAdjustment.map((cut) => cut.monthlySaving), 'GEL');
    return add(this.budget.unplannedRoom, gentle);
  }

  private plan(pace: GoalPace, amount: Money, monthly: Money): GoalPlan {
    const months = monthly.minorUnits > 0 ? Math.ceil(amount.minorUnits / monthly.minorUnits) : 0;
    const fromSpending = maxMoney(subtract(monthly, this.budget.unplannedRoom), zero('GEL'));
    return {
      pace,
      monthlySaving: monthly,
      months,
      completionDate: addMonths(this.now, months),
      adjustments: this.budget.cuts(fromSpending),
      flexibleAfter: subtract(this.budget.flexibleAllowance, monthly),
      affordability: this.affordability(monthly),
    };
  }

  private affordability(monthly: Money): Affordability {
    if (compare(monthly, this.budget.maximumSustainableSaving) > 0) return 'notAffordable';
    return compare(monthly, this.gentleMonthly) <= 0 ? 'comfortable' : 'tight';
  }
}

const PACE_RISKS: Readonly<Record<GoalPace, LocalizedText | null>> = {
  faster: lt(
    'Little room for surprises — flexible spending roughly halves.',
    'მოულოდნელობისთვის ცოტა ადგილია — მოქნილი ხარჯი დაახლოებით განახევრდება.',
  ),
  balanced: lt('One small change; most of your lifestyle stays.', 'ერთი პატარა ცვლილება; ცხოვრების წესი უმეტესად იგივე რჩება.'),
  flexible: lt('Slowest, but the most room for everyday life.', 'ყველაზე ნელი, მაგრამ ყოველდღიურობისთვის ყველაზე მეტი ადგილი.'),
  custom: null,
};

/** Honest caveats shown under a plan. */
export function planRisks(plan: GoalPlan, request: GoalRequest, display: Display): string[] {
  const risks: string[] = [];
  const paceRisk = PACE_RISKS[plan.pace];
  if (paceRisk) risks.push(display.text(paceRisk));
  if (plan.months > LONG_PLAN_MONTHS) {
    risks.push(display.t('Takes over 3 years — prices may change by then.', '3 წელზე მეტი სჭირდება — ფასები შეიძლება შეიცვალოს.'));
  }
  const costs = estimateOwnershipCosts(request.kind, request.target);
  if (costs) {
    const monthly = display.money(ownershipMonthlyTotal(costs), { precision: 'whole' });
    risks.push(
      display.t(
        `After buying, owning it adds about ${monthly} a month.`,
        `ყიდვის შემდეგ ფლობა თვეში დაახლოებით ${monthly}-ს დაამატებს.`,
      ),
    );
  }
  return risks;
}

/** Example sentences the goal planner offers. */
export function goalExamples(display: Display): string[] {
  return [
    display.t('Car worth 15,000 ₾', 'მანქანა 15 000 ₾'),
    display.t('Holiday in Batumi, 1,500 ₾', 'დასვენება ბათუმში, 1 500 ₾'),
    display.t('Apartment deposit 20,000 ₾ in 3 years', 'ბინის შენატანი 20 000 ₾ 3 წელში'),
    display.t('Emergency fund 4,000 ₾', 'სარეზერვო ფონდი 4 000 ₾'),
  ];
}

/** Step for the target amount stepper: bigger goals move in bigger steps. */
export function targetStepSize(targetAmount: number): number {
  return targetAmount >= 10_000 ? 500 : 100;
}
