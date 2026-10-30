import type { BankConnectionStatus, BankSnapshot, CurrencyCode, SpendingCategoryId } from '../../shared/bank.ts';
import {
  DEFAULT_AI_RECOMMENDATIONS_USED,
  DEFAULT_COMPLETED_LESSONS,
  DEFAULT_DELIVERY_MONTHLY_BUDGET,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PERMISSIONS,
  defaultCompletedRecommendations,
  defaultGoals,
  monthKey,
  type AppLanguage,
  type CoachQuestion,
  type CompletedRecommendation,
  type DataPermissions,
  type FinanceTransaction,
  type FinancialObjective,
  type Lesson,
  type Money,
  type NotificationPreferences,
  type PersonalInfo,
  type PriorityOverrides,
  type SavedPlan,
  type SavingsGoal,
  type SubscriptionPlan,
} from '../engine/index.ts';

export type BankSyncState = 'idle' | 'loading' | 'error';

export interface BankState {
  /** Null until the first status check answers. */
  readonly status: BankConnectionStatus | null;
  /** The latest data from TBC; kept while a refresh is loading or after it fails. */
  readonly snapshot: BankSnapshot | null;
  readonly sync: BankSyncState;
  readonly error: string | null;
}

/** Personalized AI answers used in a calendar month ("2026-10"); a new month starts from zero. */
export interface AiUsage {
  readonly month: string;
  readonly used: number;
}

/** A revised delivery budget; it starts next month so this month's numbers stay honest. */
export interface UpcomingDeliveryBudget {
  readonly amount: Money;
  /** "2026-11": the first month it applies to. */
  readonly effectiveMonth: string;
}

/** App-side state that survives a reload. Bank data and personal information never do. */
export interface PersistedState {
  readonly language: AppLanguage;
  readonly displayCurrency: CurrencyCode;
  readonly objective: FinancialObjective;
  readonly savingsTarget: Money | null;
  readonly hasCompletedOnboarding: boolean;
  readonly plan: SubscriptionPlan;
  readonly aiUsage: AiUsage;
  readonly goals: readonly SavingsGoal[];
  /** Entered by hand or from a receipt; bank transactions come from the snapshot. */
  readonly manualTransactions: readonly FinanceTransaction[];
  /** The user's category corrections, by transaction id, for bank and manual transactions alike. */
  readonly categoryOverrides: Readonly<Record<string, SpendingCategoryId>>;
  readonly priorityOverrides: PriorityOverrides;
  readonly hasReviewedBudget: boolean;
  readonly hasComparedLoan: boolean;
  readonly completedLessons: readonly Lesson[];
  readonly savedPlans: readonly SavedPlan[];
  readonly completedRecommendations: readonly CompletedRecommendation[];
  readonly deliveryMonthlyBudget: Money;
  readonly upcomingDeliveryBudget: UpcomingDeliveryBudget | null;
  readonly notifications: NotificationPreferences;
  readonly permissions: DataPermissions;
}

export interface AppState extends PersistedState {
  /** In memory only, like the iOS app. */
  readonly personalInfo: PersonalInfo | null;
  /** A question another screen asked the coach to answer when it opens. */
  readonly pendingCoachQuestion: CoachQuestion | null;
  readonly bank: BankState;
}

export const INITIAL_BANK_STATE: BankState = { status: null, snapshot: null, sync: 'idle', error: null };

/** A first launch: the iOS demo's starting point, dated relative to `now`. */
export function defaultPersistedState(now: Date): PersistedState {
  return {
    language: 'en',
    displayCurrency: 'GEL',
    objective: 'buildSavings',
    savingsTarget: null,
    ...onboardingDefaults(now),
    notifications: DEFAULT_NOTIFICATIONS,
    permissions: DEFAULT_PERMISSIONS,
  };
}

/** Settings that survive restarting onboarding. */
export type KeptOnRestart = 'language' | 'displayCurrency' | 'objective' | 'savingsTarget' | 'notifications' | 'permissions';

/** What restarting onboarding resets; language, currency, objective, target and preferences stay. */
export function onboardingDefaults(now: Date): Omit<PersistedState, KeptOnRestart> {
  return {
    hasCompletedOnboarding: false,
    plan: 'free',
    aiUsage: { month: monthKey(now), used: DEFAULT_AI_RECOMMENDATIONS_USED },
    goals: defaultGoals(now),
    manualTransactions: [],
    categoryOverrides: {},
    priorityOverrides: {},
    hasReviewedBudget: false,
    hasComparedLoan: false,
    completedLessons: DEFAULT_COMPLETED_LESSONS,
    savedPlans: [],
    completedRecommendations: defaultCompletedRecommendations(now),
    deliveryMonthlyBudget: DEFAULT_DELIVERY_MONTHLY_BUDGET,
    upcomingDeliveryBudget: null,
  };
}
