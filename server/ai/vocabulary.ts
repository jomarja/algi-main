import type { CurrencyCode, SpendingCategoryId } from '../../shared/bank.ts';
import type { CoachAction, CoachAppContext, CoachGoal } from '../../shared/coach.ts';

/** The app's fixed vocabularies, shared by request validation, the prompts and the recommendation schema. */

/** The names the app shows for each category (the iOS app's SpendingCategory titles). */
export const CATEGORY_NAMES = {
  foodDelivery: { en: 'Food delivery', ka: 'საკვების მიტანა' },
  foodAndDrink: { en: 'Food & drink', ka: 'კაფე და რესტორანი' },
  groceries: { en: 'Groceries', ka: 'სურსათი' },
  transport: { en: 'Transport', ka: 'ტრანსპორტი' },
  subscriptions: { en: 'Subscriptions', ka: 'გამოწერები' },
  shopping: { en: 'Shopping', ka: 'შოპინგი' },
  utilities: { en: 'Bills', ka: 'კომუნალურები' },
  health: { en: 'Health', ka: 'ჯანმრთელობა' },
  housing: { en: 'Rent', ka: 'ქირა' },
  debt: { en: 'Loan payments', ka: 'სესხის გადასახადი' },
  income: { en: 'Income', ka: 'შემოსავალი' },
} as const satisfies Record<SpendingCategoryId, { en: string; ka: string }>;

export const SPENDING_CATEGORY_IDS = Object.keys(CATEGORY_NAMES) as SpendingCategoryId[];

/** Where each recommendation action takes the user. */
export const ACTION_SCREENS = {
  review_budget: 'Plan → Essentials & flexible: spending by category, what is protected, upcoming bills',
  plan_goal: 'Plan → Plan a goal: goals at risk, new goals, contributions',
  what_if: 'Plan → What if…: trying a change before committing to it',
  compare_loan: 'Plan → Compare loans: what a loan or an offer really costs',
  open_transactions: 'Transactions: checking specific payments or recurring charges',
  none: 'no button, for good news that needs no action',
} as const satisfies Record<CoachAction, string>;

export const COACH_ACTIONS = Object.keys(ACTION_SCREENS) as CoachAction[];

export const LANGUAGES = ['en', 'ka'] as const satisfies readonly CoachAppContext['language'][];

export const CURRENCIES = ['GEL', 'USD', 'EUR'] as const satisfies readonly CurrencyCode[];

export const PRIORITIES = ['high', 'medium', 'low'] as const satisfies readonly CoachGoal['priority'][];
