import type {
  CoachAppContext,
  CoachChatRequest,
  CoachFinanceSummary,
  CoachGoal,
  CoachMessage,
  CoachRecommendationsRequest,
} from '../../shared/coach.ts';
import { HttpError } from '../http.ts';
import { isArray, isOneOf, isRecord } from './json.ts';
import { CURRENCIES, LANGUAGES, PRIORITIES, SPENDING_CATEGORY_IDS } from './vocabulary.ts';

/** Validates coach request bodies against shared/coach.ts. Invalid input is a 400 that names the field. */

/** Longest message a user can send, and the length Luka's older replies are clipped to. */
export const MAX_MESSAGE_CHARS = 4_000;

const limits = { messages: 200, firstName: 60, objective: 60, screen: 120, goals: 20, goalName: 80, topCategories: 12 };

const roles = ['user', 'assistant'] as const satisfies readonly CoachMessage['role'][];

export function parseChatRequest(body: unknown): CoachChatRequest {
  const root = requireRecord(body, 'body');
  return { messages: parseMessages(root.messages), context: parseAppContext(root.context) };
}

export function parseRecommendationsRequest(body: unknown): CoachRecommendationsRequest {
  const root = requireRecord(body, 'body');
  return { context: parseAppContext(root.context) };
}

function parseMessages(value: unknown): CoachMessage[] {
  const messages = requireArray(value, 'messages', limits.messages).map((item, index) => parseMessage(item, `messages[${index}]`));
  if (messages.length === 0) invalid('messages', 'must not be empty');
  if (messages[messages.length - 1].role !== 'user') invalid('messages', 'must end with a user message');
  return messages;
}

function parseMessage(value: unknown, path: string): CoachMessage {
  const item = requireRecord(value, path);
  const role = requireOneOf(item.role, roles, `${path}.role`);
  const content = requireString(item.content, `${path}.content`);
  if (!content.trim()) invalid(`${path}.content`, 'must not be empty');
  if (role === 'user' && content.length > MAX_MESSAGE_CHARS) {
    throw new HttpError(400, 'message_too_long', `${path}.content is longer than ${MAX_MESSAGE_CHARS} characters`);
  }
  return { role, content };
}

function parseAppContext(value: unknown): CoachAppContext {
  const context = requireRecord(value, 'context');
  return {
    language: requireOneOf(context.language, LANGUAGES, 'context.language'),
    displayCurrency: requireOneOf(context.displayCurrency, CURRENCIES, 'context.displayCurrency'),
    userFirstName: requireString(context.userFirstName, 'context.userFirstName', limits.firstName),
    objective: requireString(context.objective, 'context.objective', limits.objective),
    goals: requireArray(context.goals, 'context.goals', limits.goals).map((goal, index) => parseGoal(goal, `context.goals[${index}]`)),
    summary: context.summary === null ? null : parseSummary(context.summary, 'context.summary'),
    screen: requireString(context.screen, 'context.screen', limits.screen),
  };
}

function parseGoal(value: unknown, path: string): CoachGoal {
  const goal = requireRecord(value, path);
  const name = requireString(goal.name, `${path}.name`, limits.goalName);
  if (!name.trim()) invalid(`${path}.name`, 'must not be empty');
  return {
    name,
    target: requireNumber(goal.target, `${path}.target`, 0),
    saved: requireNumber(goal.saved, `${path}.saved`, 0),
    targetDate: requireDate(goal.targetDate, `${path}.targetDate`),
    monthlyContribution: requireNumber(goal.monthlyContribution, `${path}.monthlyContribution`, 0),
    priority: requireOneOf(goal.priority, PRIORITIES, `${path}.priority`),
  };
}

function parseSummary(value: unknown, path: string): CoachFinanceSummary {
  const summary = requireRecord(value, path);
  return {
    monthlyIncome: requireNumber(summary.monthlyIncome, `${path}.monthlyIncome`),
    monthlySpending: requireNumber(summary.monthlySpending, `${path}.monthlySpending`),
    monthlyPlan: requireNumber(summary.monthlyPlan, `${path}.monthlyPlan`),
    remainingThisMonth: requireNumber(summary.remainingThisMonth, `${path}.remainingThisMonth`),
    safeToSpendToday: requireNumber(summary.safeToSpendToday, `${path}.safeToSpendToday`),
    topCategories: requireArray(summary.topCategories, `${path}.topCategories`, limits.topCategories).map((item, index) => {
      const itemPath = `${path}.topCategories[${index}]`;
      const entry = requireRecord(item, itemPath);
      return {
        category: requireOneOf(entry.category, SPENDING_CATEGORY_IDS, `${itemPath}.category`),
        spent: requireNumber(entry.spent, `${itemPath}.spent`),
        budget: entry.budget === null ? null : requireNumber(entry.budget, `${itemPath}.budget`),
      };
    }),
  };
}

// MARK: Readers

function invalid(path: string, problem: string): never {
  throw new HttpError(400, 'invalid_request', `${path} ${problem}`);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) invalid(path, 'must be an object');
  return value;
}

function requireArray(value: unknown, path: string, maxItems: number): unknown[] {
  if (!isArray(value)) invalid(path, 'must be an array');
  if (value.length > maxItems) invalid(path, `must have at most ${maxItems} items`);
  return value;
}

function requireString(value: unknown, path: string, maxLength = Number.POSITIVE_INFINITY): string {
  if (typeof value !== 'string') invalid(path, 'must be a string');
  if (value.length > maxLength) invalid(path, `must be at most ${maxLength} characters`);
  return value;
}

function requireNumber(value: unknown, path: string, min = Number.NEGATIVE_INFINITY): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'must be a finite number');
  if (value < min) invalid(path, `must be at least ${min}`);
  return value;
}

function requireOneOf<T extends string>(value: unknown, options: readonly T[], path: string): T {
  if (!isOneOf(value, options)) invalid(path, `must be one of ${options.join(', ')}`);
  return value;
}

function requireDate(value: unknown, path: string): string {
  const text = requireString(value, path);
  if (!isCalendarDate(text)) invalid(path, 'must be a date as YYYY-MM-DD');
  return text;
}

/** True for real days only: "2026-02-30" and "2026-13-01" are rejected. */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}
