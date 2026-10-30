import { AVERAGE_DAYS_PER_MONTH, daysBetween, WEEKS_PER_MONTH } from './calendar.ts';
import type { Display } from './display.ts';
import { compare, divide, isZero, maxMoney, multiply, roundedToMultiple, subtract, zero, type Money } from './money.ts';
import type { MascotPose, TagTone } from './presentation.ts';
import { round } from './rounding.ts';
import { GoalProjection, type SavingsGoal } from './savingsGoal.ts';

export type MilestoneState = 'reached' | 'current' | 'upcoming';

export interface JourneyMilestone {
  readonly index: number;
  readonly amount: Money;
  /** Position along the path, 0...1. */
  readonly fraction: number;
  readonly state: MilestoneState;
}

export function isDestination(milestone: JourneyMilestone): boolean {
  return milestone.fraction >= 1;
}

export type JourneySchedule =
  | { readonly kind: 'arrived' }
  | { readonly kind: 'ahead'; readonly days: number }
  | { readonly kind: 'onSchedule' }
  | { readonly kind: 'behind'; readonly days: number }
  | { readonly kind: 'notMoving' };

export const MILESTONE_COUNT = 8;
/** Within this many days of the target date counts as on schedule. */
export const ON_SCHEDULE_TOLERANCE_DAYS = 7;

/**
 * A savings goal seen as a trip: checkpoints along a path, today's position, and how the pace compares
 * with the target date. Schedule estimates assume the monthly contribution stays the same.
 */
export class Journey {
  readonly goal: SavingsGoal;
  readonly now: Date;

  constructor(goal: SavingsGoal, now: Date) {
    this.goal = goal;
    this.now = now;
  }

  get projection(): GoalProjection {
    return new GoalProjection(this.goal, this.now);
  }

  get progress(): number {
    return this.projection.progress;
  }

  get milestones(): JourneyMilestone[] {
    const indexes = Array.from({ length: MILESTONE_COUNT }, (_, offset) => offset + 1);
    const isReached = (index: number) => compare(this.amount(index), this.goal.saved) <= 0;
    const firstUnreached = indexes.find((index) => !isReached(index));
    const stateOf = (index: number): MilestoneState => {
      if (isReached(index)) return 'reached';
      return index === firstUnreached ? 'current' : 'upcoming';
    };
    return indexes.map((index) => ({
      index,
      amount: this.amount(index),
      fraction: index / MILESTONE_COUNT,
      state: stateOf(index),
    }));
  }

  get nextMilestone(): JourneyMilestone | null {
    return this.milestones.find((milestone) => milestone.state === 'current') ?? null;
  }

  get reachedCount(): number {
    return this.milestones.filter((milestone) => milestone.state === 'reached').length;
  }

  get amountToNextMilestone(): Money {
    const next = this.nextMilestone;
    return next ? subtract(next.amount, this.goal.saved) : zero(this.goal.target.currency);
  }

  get schedule(): JourneySchedule {
    const projection = this.projection;
    if (isZero(projection.remaining)) return { kind: 'arrived' };
    const completion = projection.completionDate(this.goal.monthlyContribution);
    if (!completion) return { kind: 'notMoving' };
    const days = daysBetween(completion, this.goal.targetDate);
    if (Math.abs(days) <= ON_SCHEDULE_TOLERANCE_DAYS) return { kind: 'onSchedule' };
    return days > 0 ? { kind: 'ahead', days } : { kind: 'behind', days: -days };
  }

  scheduleLabel(display: Display): string {
    const schedule = this.schedule;
    switch (schedule.kind) {
      case 'arrived':
        return display.t('Arrived', 'მიღწეულია');
      case 'onSchedule':
        return display.t('On schedule', 'გრაფიკით');
      case 'ahead': {
        const duration = journeyDuration(schedule.days, display);
        return display.t(`About ${duration} ahead`, `დაახლოებით ${duration} უსწრებ`);
      }
      case 'behind': {
        const duration = journeyDuration(schedule.days, display);
        return display.t(`About ${duration} behind`, `დაახლოებით ${duration} ჩამორჩები`);
      }
      case 'notMoving':
        return display.t('Not moving yet', 'ჯერ არ დაძრულა');
    }
  }

  get scheduleTone(): TagTone {
    const { kind } = this.schedule;
    return kind === 'behind' || kind === 'notMoving' ? 'attention' : 'positive';
  }

  /** Luka's reaction: celebrates progress, stays calm and constructive when behind. */
  reaction(display: Display): { readonly pose: MascotPose; readonly message: string } {
    switch (this.schedule.kind) {
      case 'arrived':
        return { pose: 'achievement', message: display.t('You made it!', 'შენ შეძელი!') };
      case 'ahead':
        return { pose: 'savings', message: display.t('Ahead of schedule — nice pace!', 'გრაფიკს უსწრებ — კარგი ტემპია!') };
      case 'onSchedule':
        return { pose: 'savings', message: display.t('Right on schedule.', 'ზუსტად გრაფიკით მიდიხარ.') };
      case 'behind':
        return {
          pose: 'overspending',
          message: display.t('A bit behind. Small steps get us back.', 'ოდნავ ჩამოვრჩით. პატარა ნაბიჯებით დავეწევით.'),
        };
      case 'notMoving':
        return { pose: 'insight', message: display.t("Let's get moving — even 20 ₾ counts.", 'დავიძრათ — 20 ₾-იც ითვლება.') };
    }
  }

  accessibilitySummary(display: Display): string {
    const name = display.text(this.goal.name);
    const percent = round(this.progress * 100);
    const label = this.scheduleLabel(display);
    return display.t(
      `${name} journey: ${percent}% of the way, ${this.reachedCount} of ${MILESTONE_COUNT} checkpoints reached, ${label}.`,
      `„${name}“: გავლილია ${percent}%, ${MILESTONE_COUNT}-დან ${this.reachedCount} საკონტროლო წერტილი, ${label}.`,
    );
  }

  /** The coaching line under the journey: what to do next given the schedule. */
  nextActionMessage(display: Display): string {
    const money = (value: Money) => display.money(value, { precision: 'whole' });
    const weeklyContribution = divide(this.goal.monthlyContribution, WEEKS_PER_MONTH);
    switch (this.schedule.kind) {
      case 'arrived':
        return display.t("You've arrived. Ready to plan the next journey?", 'მიზანს მიაღწიე. დავგეგმოთ შემდეგი გზა?');
      case 'notMoving':
        return display.t('Set a monthly amount — even a small one gets you moving.', 'დააწესე თვიური თანხა — პატარაც კი დაგძრავს.');
      case 'behind': {
        const extraWeekly = maxMoney(subtract(this.projection.requiredWeekly, weeklyContribution), zero('GEL'));
        return display.t(
          `Add about ${money(extraWeekly)} a week to catch up, or choose a new pace.`,
          `დასაწევად კვირაში დაახლოებით ${money(extraWeekly)} დაამატე, ან აირჩიე ახალი ტემპი.`,
        );
      }
      case 'ahead':
      case 'onSchedule': {
        const weeks =
          weeklyContribution.minorUnits > 0
            ? Math.ceil(this.amountToNextMilestone.minorUnits / weeklyContribution.minorUnits)
            : 0;
        return display.t(
          `Keep ${money(this.goal.monthlyContribution)} a month going — next checkpoint in about ${weeks} weeks.`,
          `გააგრძელე თვეში ${money(this.goal.monthlyContribution)} — შემდეგ წერტილამდე დაახლოებით ${weeks} კვირაა.`,
        );
      }
    }
  }

  /** Checkpoint amounts at even steps, rounded to 10; the last one is exactly the target. */
  private amount(index: number): Money {
    if (index === MILESTONE_COUNT) return this.goal.target;
    return roundedToMultiple(multiply(this.goal.target, index / MILESTONE_COUNT), 10);
  }
}

/** "1 week" / "3 months" in English, and the instrumental form Georgian needs ("1 კვირით", "3 თვით"). */
export function journeyDuration(days: number, display: Display): string {
  if (days < 28) {
    const weeks = Math.max(round(days / 7), 1);
    return display.t(weeks === 1 ? '1 week' : `${weeks} weeks`, `${weeks} კვირით`);
  }
  const months = Math.max(round(days / AVERAGE_DAYS_PER_MONTH), 1);
  if (months >= 24) {
    const years = Math.floor(months / 12);
    return display.t(`${years} years`, `${years} წლით`);
  }
  return display.t(months === 1 ? '1 month' : `${months} months`, `${months} თვით`);
}

export interface Celebration {
  readonly title: string;
  readonly message: string;
}

/** The celebration to show after adding money, when it reached a new checkpoint. */
export function checkpointCelebration(before: Journey, after: Journey, display: Display): Celebration | null {
  if (after.reachedCount <= before.reachedCount) return null;
  const goal = after.goal;
  const name = display.text(goal.name);
  if (after.schedule.kind === 'arrived') {
    return {
      title: display.t("You've arrived!", 'მიხვედი!'),
      message: display.t(`${name} is fully funded. What a journey.`, `„${name}“ სრულად შევსებულია. რა გზა გაიარე!`),
    };
  }
  const saved = display.money(goal.saved, { precision: 'whole' });
  const target = display.money(goal.target, { precision: 'whole' });
  return {
    title: display.t(
      `Checkpoint ${after.reachedCount} of ${MILESTONE_COUNT}!`,
      `${MILESTONE_COUNT}-დან ${after.reachedCount} წერტილი!`,
    ),
    message: display.t(
      `${saved} of ${target} saved for ${name}. Small steps add up.`,
      `„${name}“: ${target}-დან ${saved} დაზოგილია. პატარა ნაბიჯები ერთად დიდ შედეგს იძლევა.`,
    ),
  };
}
