import type { CurrencyCode, SpendingCategoryId } from './bank.ts';

/**
 * The AI coach ("Luka") contract. The server adds the user's latest open banking data from their
 * session to every request, so the browser only sends what the bank cannot know: goals, plans,
 * preferences, and the screen the user is on.
 */

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachGoal {
  name: string;
  target: number;
  saved: number;
  /** YYYY-MM-DD. */
  targetDate: string;
  monthlyContribution: number;
  priority: 'high' | 'medium' | 'low';
}

/** Figures the app already computed from the bank data, so the coach and the screens agree. */
export interface CoachFinanceSummary {
  monthlyIncome: number;
  monthlySpending: number;
  monthlyPlan: number;
  remainingThisMonth: number;
  safeToSpendToday: number;
  topCategories: Array<{ category: SpendingCategoryId; spent: number; budget: number | null }>;
}

export interface CoachAppContext {
  language: 'en' | 'ka';
  displayCurrency: CurrencyCode;
  userFirstName: string;
  /** The user's main objective from onboarding, e.g. "buildSavings". */
  objective: string;
  goals: CoachGoal[];
  summary: CoachFinanceSummary | null;
  /** Route the user is on when they ask, e.g. "/plan/goal". */
  screen: string;
}

export interface CoachChatRequest {
  messages: CoachMessage[];
  context: CoachAppContext;
}

/**
 * POST /api/coach/chat answers as Server-Sent Events:
 *   event: delta  data: { "text": "..." }
 *   event: done   data: { "stopReason": "end_turn" }
 *   event: error  data: { "message": "..." }
 */
export type CoachStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; stopReason: string }
  | { type: 'error'; message: string };

/** Actions the app can open for a recommendation. */
export type CoachAction = 'review_budget' | 'plan_goal' | 'compare_loan' | 'what_if' | 'open_transactions' | 'none';

export interface CoachRecommendation {
  id: string;
  title: string;
  detail: string;
  /** Monthly amount freed or gained in `displayCurrency`, when it can be estimated. */
  impactMonthly: number | null;
  category: SpendingCategoryId | null;
  action: CoachAction;
  /** Facts from the user's own data that support it. */
  evidence: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface CoachRecommendationsRequest {
  context: CoachAppContext;
}

export interface CoachRecommendationsResponse {
  recommendations: CoachRecommendation[];
  generatedAt: string;
  model: string;
}

/** GET /api/coach/status */
export interface CoachStatus {
  available: boolean;
  model: string;
}
