import {
  addMonths,
  goalFromDraft,
  majorUnits,
  type Display,
  type GoalDraftFields,
  type Money,
  type SavingsGoal,
} from '../../engine/index.ts';

/** New goals default to a target date this many months away (the iOS form starts eight months ahead). */
export const DEFAULT_GOAL_MONTHS = 8;

/** An empty goal form; the target the user mentioned during onboarding is filled in. */
export function newGoalDraft(now: Date, savingsTarget: Money | null): GoalDraftFields {
  return {
    name: '',
    icon: 'travel',
    targetText: savingsTarget ? String(Math.trunc(majorUnits(savingsTarget))) : '',
    savedText: '',
    monthlyText: '',
    targetDate: addMonths(now, DEFAULT_GOAL_MONTHS),
    priority: 'medium',
  };
}

/** The form for editing an existing goal; zero amounts are left blank so the placeholder shows. */
export function goalDraftFrom(goal: SavingsGoal, display: Display): GoalDraftFields {
  return {
    name: display.text(goal.name),
    icon: goal.icon,
    targetText: amountText(goal.target),
    savedText: amountText(goal.saved),
    monthlyText: amountText(goal.monthlyContribution),
    targetDate: goal.targetDate,
    priority: goal.priority,
  };
}

/**
 * The goal as edited, or null while the form is incomplete. An untouched name keeps both of its translations
 * instead of becoming a single-language name.
 */
export function editedGoal(original: SavingsGoal, fields: GoalDraftFields, display: Display): SavingsGoal | null {
  const goal = goalFromDraft(fields, original.id);
  if (!goal) return null;
  const isNameUnchanged = fields.name.trim() === display.text(original.name);
  return isNameUnchanged ? { ...goal, name: original.name } : goal;
}

function amountText(value: Money): string {
  return value.minorUnits === 0 ? '' : String(majorUnits(value));
}
