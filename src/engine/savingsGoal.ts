import { addMonths, AVERAGE_DAYS_PER_MONTH, daysBetween } from './calendar.ts';
import { newId } from './ids.ts';
import { lt, type LocalizedText } from './localization.ts';
import {
  add,
  compare,
  fraction,
  fromMinorUnits,
  gel,
  isZero,
  maxMoney,
  multiply,
  parseMoney,
  subtract,
  zero,
  type Money,
} from './money.ts';
import type { PaletteToken } from './palette.ts';
import type { JourneyDestination, TagTone } from './presentation.ts';

export type GoalPriority = 'high' | 'medium' | 'low';

/** Highest priority first. */
export const GOAL_PRIORITIES: readonly GoalPriority[] = ['high', 'medium', 'low'];

export const GOAL_PRIORITY_TITLES: Readonly<Record<GoalPriority, LocalizedText>> = {
  high: lt('High', 'მაღალი'),
  medium: lt('Medium', 'საშუალო'),
  low: lt('Low', 'დაბალი'),
};

export function goalPrioritySortOrder(priority: GoalPriority): number {
  return GOAL_PRIORITIES.indexOf(priority);
}

export type GoalIcon = 'shield' | 'home' | 'travel' | 'laptop' | 'car' | 'gift' | 'loan';

export interface GoalIconMeta {
  /** SF Symbol name; the design system maps it to an icon. */
  readonly symbol: string;
  readonly tint: PaletteToken;
  readonly background: PaletteToken;
  readonly destination: JourneyDestination;
}

export const GOAL_ICONS: readonly GoalIcon[] = ['shield', 'home', 'travel', 'laptop', 'car', 'gift', 'loan'];

export const GOAL_ICON_META: Readonly<Record<GoalIcon, GoalIconMeta>> = {
  shield: { symbol: 'shield.lefthalf.filled', tint: 'lavender', background: 'lavenderPale', destination: 'shield' },
  home: { symbol: 'house.fill', tint: 'amberDeep', background: 'amberPale', destination: 'home' },
  travel: { symbol: 'airplane', tint: 'coral', background: 'coralPale', destination: 'holiday' },
  laptop: { symbol: 'laptopcomputer', tint: 'mintDark', background: 'mintPale', destination: 'gift' },
  car: { symbol: 'car.fill', tint: 'coral', background: 'coralPale', destination: 'car' },
  gift: { symbol: 'gift.fill', tint: 'amberDeep', background: 'amberPale', destination: 'gift' },
  loan: { symbol: 'creditcard.fill', tint: 'mintDark', background: 'mintPale', destination: 'loan' },
};

export interface SavingsGoal {
  readonly id: string;
  readonly name: LocalizedText;
  readonly icon: GoalIcon;
  readonly target: Money;
  readonly saved: Money;
  readonly targetDate: Date;
  readonly monthlyContribution: Money;
  readonly priority: GoalPriority;
}

export type GoalStatus = 'reached' | 'onTrack' | 'slightlyBehind' | 'unlikely';

export const GOAL_STATUS_META: Readonly<Record<GoalStatus, { readonly label: LocalizedText; readonly tone: TagTone }>> = {
  reached: { label: lt('Reached', 'მიღწეულია'), tone: 'positive' },
  onTrack: { label: lt('On track', 'გეგმის მიხედვით'), tone: 'positive' },
  slightlyBehind: { label: lt('A little behind', 'ოდნავ ჩამორჩება'), tone: 'attention' },
  unlikely: { label: lt('Needs a new plan', 'ახალი გეგმა სჭირდება'), tone: 'attention' },
};

export type ScenarioKind = 'current' | 'conservative' | 'revised';

export const SCENARIO_META: Readonly<Record<ScenarioKind, { readonly title: LocalizedText; readonly tint: PaletteToken }>> = {
  current: { title: lt('Current pace', 'ახლანდელი ტემპი'), tint: 'mint' },
  conservative: { title: lt('Conservative pace', 'ფრთხილი ტემპი'), tint: 'amber' },
  revised: { title: lt('Revised spending plan', 'განახლებული ხარჯების გეგმა'), tint: 'lavender' },
};

export interface GoalScenario {
  readonly kind: ScenarioKind;
  readonly monthlyContribution: Money;
  readonly projectedAtTargetDate: Money;
  readonly completionDate: Date | null;
}

export interface GoalCheckpoint {
  readonly date: Date;
  readonly saved: Money;
}

export const CONSERVATIVE_FACTOR = 0.75;
export const SLIGHTLY_BEHIND_THRESHOLD = 0.85;
/** Extra monthly saving in the "revised spending plan" scenario: 40 ₾ less delivery and 40 ₾ less eating out. */
export const REVISED_PLAN_EXTRA = gel(80);
/** Shares of a goal that get a celebration when reached. */
export const GOAL_MILESTONE_FRACTIONS: readonly number[] = [0.5, 0.75, 1];

/**
 * Transparent, deterministic projections for a savings goal. Every value here is an estimate
 * that assumes contributions stay constant; the UI labels them that way.
 */
export class GoalProjection {
  readonly goal: SavingsGoal;
  readonly now: Date;

  constructor(goal: SavingsGoal, now: Date) {
    this.goal = goal;
    this.now = now;
  }

  get remaining(): Money {
    return maxMoney(subtract(this.goal.target, this.goal.saved), zero(this.goal.target.currency));
  }

  get progress(): number {
    return Math.min(Math.max(fraction(this.goal.saved, this.goal.target), 0), 1);
  }

  get daysRemaining(): number {
    return Math.max(daysBetween(this.now, this.goal.targetDate), 0);
  }

  get monthsRemaining(): number {
    return this.daysRemaining / AVERAGE_DAYS_PER_MONTH;
  }

  get weeksRemaining(): number {
    return this.daysRemaining / 7;
  }

  get requiredMonthly(): Money {
    return this.contribution(this.monthsRemaining);
  }

  get requiredWeekly(): Money {
    return this.contribution(this.weeksRemaining);
  }

  get status(): GoalStatus {
    if (isZero(this.remaining)) return 'reached';
    const projectedShare = fraction(this.projectedSaved(this.goal.monthlyContribution), this.goal.target);
    if (projectedShare >= 1) return 'onTrack';
    return projectedShare >= SLIGHTLY_BEHIND_THRESHOLD ? 'slightlyBehind' : 'unlikely';
  }

  projectedSaved(monthlyContribution: Money): Money {
    return add(this.goal.saved, multiply(monthlyContribution, this.monthsRemaining));
  }

  completionDate(monthlyContribution: Money): Date | null {
    if (isZero(this.remaining)) return this.now;
    if (monthlyContribution.minorUnits <= 0) return null;
    const months = Math.ceil(this.remaining.minorUnits / monthlyContribution.minorUnits);
    return addMonths(this.now, months);
  }

  /** Compares the current pace with a cautious pace and with a revised spending plan. */
  scenarios(revisedPlanExtra: Money): GoalScenario[] {
    const current = this.goal.monthlyContribution;
    return [
      this.scenario('current', current),
      this.scenario('conservative', multiply(current, CONSERVATIVE_FACTOR)),
      this.scenario('revised', add(current, revisedPlanExtra)),
    ];
  }

  /** Month-by-month checkpoints from today up to the target date, for charts. */
  checkpoints(monthlyContribution: Money): GoalCheckpoint[] {
    const points: GoalCheckpoint[] = [{ date: this.now, saved: this.goal.saved }];
    const end = this.goal.targetDate.getTime();
    for (let month = 1; addMonths(this.now, month).getTime() < end; month += 1) {
      points.push({ date: addMonths(this.now, month), saved: add(this.goal.saved, multiply(monthlyContribution, month)) });
    }
    points.push({ date: this.goal.targetDate, saved: this.projectedSaved(monthlyContribution) });
    return points;
  }

  private scenario(kind: ScenarioKind, contribution: Money): GoalScenario {
    return {
      kind,
      monthlyContribution: contribution,
      projectedAtTargetDate: this.projectedSaved(contribution),
      completionDate: this.completionDate(contribution),
    };
  }

  private contribution(periods: number): Money {
    if (periods <= 0) return this.remaining;
    return fromMinorUnits(Math.ceil(this.remaining.minorUnits / periods), this.remaining.currency);
  }
}

/** The milestone share crossed by moving from `before` to `after` progress, if any. */
export function celebratedMilestone(before: number, after: number): number | null {
  return GOAL_MILESTONE_FRACTIONS.filter((share) => before < share && after >= share).at(-1) ?? null;
}

export interface GoalDraftFields {
  readonly name: string;
  readonly icon: GoalIcon;
  readonly targetText: string;
  readonly savedText: string;
  readonly monthlyText: string;
  readonly targetDate: Date;
  readonly priority: GoalPriority;
}

/** The goal as currently entered, or null while required fields are missing or inconsistent. */
export function goalFromDraft(fields: GoalDraftFields, id: string = newId()): SavingsGoal | null {
  const name = fields.name.trim();
  const target = parseMoney(fields.targetText, 'GEL');
  if (!name || !target || target.minorUnits <= 0) return null;
  const saved = parseMoney(fields.savedText, 'GEL') ?? zero('GEL');
  if (compare(saved, target) >= 0) return null;
  return {
    id,
    name: lt(name, name),
    icon: fields.icon,
    target,
    saved,
    targetDate: fields.targetDate,
    monthlyContribution: parseMoney(fields.monthlyText, 'GEL') ?? zero('GEL'),
    priority: fields.priority,
  };
}
