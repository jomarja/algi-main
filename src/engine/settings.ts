import { lt, type LocalizedText } from './localization.ts';
import { gel, isZero, parseMoney, type Money } from './money.ts';

export type FinancialObjective = 'buildSavings' | 'controlSpending' | 'understandHabits' | 'emergencyFund';

export const FINANCIAL_OBJECTIVES: readonly FinancialObjective[] = [
  'buildSavings',
  'controlSpending',
  'understandHabits',
  'emergencyFund',
];

export const OBJECTIVE_META: Readonly<Record<FinancialObjective, { readonly title: LocalizedText; readonly icon: string }>> = {
  buildSavings: { title: lt('Build my savings', 'დანაზოგის შექმნა'), icon: 'banknote.fill' },
  controlSpending: { title: lt('Control my spending', 'ხარჯების კონტროლი'), icon: 'slider.horizontal.3' },
  understandHabits: { title: lt('Understand my habits', 'ჩვევების გაგება'), icon: 'chart.bar.xaxis' },
  emergencyFund: { title: lt('Create an emergency fund', 'სარეზერვო ფონდის შექმნა'), icon: 'shield.lefthalf.filled' },
};

export type SubscriptionPlan = 'free' | 'premium';

/** Personalized AI answers included in the free plan each month. */
export const FREE_MONTHLY_AI_RECOMMENDATIONS = 5;
export const PREMIUM_MONTHLY_PRICE = gel(5);

export interface NotificationPreferences {
  readonly weeklyPlan: boolean;
  readonly budgetNudges: boolean;
  readonly goalMilestones: boolean;
  readonly productNews: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  weeklyPlan: true,
  budgetNudges: true,
  goalMilestones: true,
  productNews: false,
};

export interface DataPermissions {
  readonly useTransactionsForCoaching: boolean;
  readonly personalizedNudges: boolean;
  readonly anonymousAnalytics: boolean;
}

export const DEFAULT_PERMISSIONS: DataPermissions = {
  useTransactionsForCoaching: true,
  personalizedNudges: true,
  anonymousAnalytics: false,
};

/** The savings target typed during onboarding; empty or zero means "not set". */
export function parseSavingsTarget(text: string): Money | null {
  const target = parseMoney(text, 'GEL');
  return target && !isZero(target) ? target : null;
}
