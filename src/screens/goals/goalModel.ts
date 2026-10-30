import {
  compare,
  divide,
  maxMoney,
  round,
  subtract,
  WEEKS_PER_MONTH,
  zero,
  type Celebration,
  type Display,
  type GoalProjection,
  type GoalScenario,
  type GoalStatus,
  type Money,
  type SavingsGoal,
} from '../../engine/index.ts';

/** Behind or unlikely: the goal needs a new pace, a later date or more money. */
export function needsNewPace(status: GoalStatus): boolean {
  return status === 'slightlyBehind' || status === 'unlikely';
}

/** How much more a week it would take to stay on schedule; zero when the current contribution is enough. */
export function weeklyGap(goal: SavingsGoal, projection: GoalProjection): Money {
  const weeklyContribution = divide(goal.monthlyContribution, WEEKS_PER_MONTH);
  return maxMoney(subtract(projection.requiredWeekly, weeklyContribution), zero(goal.target.currency));
}

export function reachesTargetOnTime(scenario: GoalScenario, goal: SavingsGoal): boolean {
  return compare(scenario.projectedAtTargetDate, goal.target) >= 0;
}

/** The celebration for passing 50%, 75% or 100% of a goal (GoalDetailView.swift). */
export function milestoneCelebration(share: number, goal: SavingsGoal, display: Display): Celebration {
  const name = display.text(goal.name);
  const percent = round(share * 100);
  return {
    title:
      share >= 1
        ? display.t('Goal reached!', 'მიზანი მიღწეულია!')
        : display.t(`${percent}% of the way there!`, `გზის ${percent}% გავლილია!`),
    message: display.t(
      `${name} just passed a milestone. Small steps add up.`,
      `„${name}“-მა ახალ ეტაპს მიაღწია. პატარა ნაბიჯები ერთად დიდ შედეგს იძლევა.`,
    ),
  };
}
