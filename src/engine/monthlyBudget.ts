import { WEEKS_PER_MONTH } from './calendar.ts';
import { CATEGORY_META, type SpendingCategoryId, type SpendingPriority } from './categories.ts';
import { lt, type LocalizedText } from './localization.ts';
import {
  add,
  compare,
  divide,
  maxMoney,
  minMoney,
  multiply,
  roundedToMultiple,
  subtract,
  sum,
  zero,
  type Money,
} from './money.ts';

export interface BudgetLine {
  readonly category: SpendingCategoryId;
  readonly monthlyAmount: Money;
}

export interface UpcomingPayment {
  readonly id: string;
  readonly title: LocalizedText;
  readonly category: SpendingCategoryId;
  /** In the currency it will be charged in. */
  readonly amount: Money;
  readonly dueDate: Date;
  /** The amount is a guess from earlier payments, e.g. a metered bill. */
  readonly isEstimate: boolean;
}

/** Where a monthly saving could come from, and what it means day to day. */
export interface CutSuggestion {
  readonly category: SpendingCategoryId;
  readonly monthlySaving: Money;
  readonly lifestyleNote: LocalizedText;
}

/** The user's own choices; anything missing falls back to the category default. */
export type PriorityOverrides = Readonly<Partial<Record<SpendingCategoryId, SpendingPriority>>>;

export interface MonthlyBudgetInput {
  readonly income: Money;
  readonly lines: readonly BudgetLine[];
  readonly savingsContributions: Money;
  readonly priorities?: PriorityOverrides;
}

/** A gentle change: about a fifth of a flexible category. */
export const GENTLE_CUT_SHARE = 0.2;
/** Never suggest cutting more than half of any flexible category. */
export const MAXIMUM_CUT_SHARE = 0.5;

/**
 * A month of money split into essentials, savings, and flexible spending.
 * Essentials are protected: suggestions only ever draw on flexible categories.
 */
export class MonthlyBudget {
  readonly income: Money;
  readonly lines: readonly BudgetLine[];
  readonly savingsContributions: Money;
  readonly priorities: PriorityOverrides;

  constructor(input: MonthlyBudgetInput) {
    this.income = input.income;
    this.lines = input.lines;
    this.savingsContributions = input.savingsContributions;
    this.priorities = input.priorities ?? {};
  }

  priority(category: SpendingCategoryId): SpendingPriority {
    const meta = CATEGORY_META[category];
    if (meta.isAlwaysProtected) return 'essential';
    return this.priorities[category] ?? meta.defaultPriority;
  }

  get essentialLines(): BudgetLine[] {
    return this.lines.filter((line) => this.priority(line.category) === 'essential');
  }

  get flexibleLines(): BudgetLine[] {
    return this.lines
      .filter((line) => this.priority(line.category) === 'flexible')
      .sort((lhs, rhs) => compare(rhs.monthlyAmount, lhs.monthlyAmount));
  }

  get essentialTotal(): Money {
    return this.total(this.essentialLines);
  }

  get flexibleTotal(): Money {
    return this.total(this.flexibleLines);
  }

  /** Essentials paid day to day (groceries, transport, health), as opposed to fixed costs like rent. */
  get dayToDayEssentialTotal(): Money {
    return this.total(this.essentialLines.filter((line) => !CATEGORY_META[line.category].isFixedCost));
  }

  /** What's left for flexible spending once essentials and savings are covered. */
  get flexibleAllowance(): Money {
    return subtract(subtract(this.income, this.essentialTotal), this.savingsContributions);
  }

  /** Flexible money not used by a typical month's flexible spending. */
  get unplannedRoom(): Money {
    return maxMoney(subtract(this.flexibleAllowance, this.flexibleTotal), zero(this.income.currency));
  }

  /**
   * The most that could go to a new goal each month without touching essentials:
   * all unplanned room plus at most half of each flexible category.
   */
  get maximumSustainableSaving(): Money {
    const fromFlexible = this.flexibleLines.map((line) => multiply(line.monthlyAmount, MAXIMUM_CUT_SHARE));
    return add(this.unplannedRoom, sum(fromFlexible, this.income.currency));
  }

  /** Everything except savings: the month's spending plan. */
  get monthlyPlan(): Money {
    return maxMoney(subtract(this.income, this.savingsContributions), zero(this.income.currency));
  }

  /** Day-to-day money per week (groceries, transport, health, and flexible spending), in 5 ₾ steps. */
  get weeklyPlan(): Money {
    const flexible = maxMoney(this.flexibleAllowance, zero(this.income.currency));
    return roundedToMultiple(divide(add(this.dayToDayEssentialTotal, flexible), WEEKS_PER_MONTH), 5);
  }

  /** A small, easy adjustment: about a fifth of the two largest flexible categories, in 5 ₾ steps. */
  get gentleAdjustment(): CutSuggestion[] {
    return this.flexibleLines.slice(0, 2).flatMap((line) => {
      const saving = roundedToMultiple(multiply(line.monthlyAmount, GENTLE_CUT_SHARE), 5);
      return saving.minorUnits > 0 ? [cutSuggestion(line.category, saving)] : [];
    });
  }

  /**
   * Where `target` per month could come from, largest flexible categories first.
   * Essentials are never included, and no category gives up more than half.
   */
  cuts(toFree: Money): CutSuggestion[] {
    let remaining = toFree;
    const suggestions: CutSuggestion[] = [];
    for (const line of this.flexibleLines) {
      if (remaining.minorUnits <= 0) break;
      const cap = roundedToMultiple(multiply(line.monthlyAmount, MAXIMUM_CUT_SHARE), 5, 'down');
      const saving = minMoney(roundedToMultiple(remaining, 5, 'up'), cap);
      if (saving.minorUnits <= 0) continue;
      suggestions.push(cutSuggestion(line.category, saving));
      remaining = subtract(remaining, saving);
    }
    return suggestions;
  }

  private total(lines: readonly BudgetLine[]): Money {
    return sum(lines.map((line) => line.monthlyAmount), this.income.currency);
  }
}

export function lifestyleNote(category: SpendingCategoryId): LocalizedText {
  switch (category) {
    case 'foodDelivery':
      return lt('One fewer delivery every week or two', 'ერთი შეკვეთით ნაკლები კვირაში ან ორში');
    case 'foodAndDrink':
      return lt('Cook at home one more evening a week', 'კვირაში ერთი საღამოთი მეტი სახლში მომზადება');
    case 'shopping':
      return lt('Wait 48 hours before non-essential buys', 'არააუცილებელ ყიდვამდე 48 საათი დაელოდე');
    case 'subscriptions':
      return lt('Pause a service you rarely open', 'შეაჩერე იშვიათად გამოყენებული სერვისი');
    default:
      return lt('Trim this a little, at your own pace', 'ცოტათი შეამცირე, შენი ტემპით');
  }
}

function cutSuggestion(category: SpendingCategoryId, monthlySaving: Money): CutSuggestion {
  return { category, monthlySaving, lifestyleNote: lifestyleNote(category) };
}
