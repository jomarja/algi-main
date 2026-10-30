import type { SpendingCategoryId } from '../../shared/bank.ts';
import {
  APP_LANGUAGES,
  CURRENCIES,
  FINANCIAL_OBJECTIVES,
  GOAL_ICONS,
  GOAL_PRIORITIES,
  LESSONS,
  SPENDING_CATEGORIES,
  SPENDING_PRIORITIES,
  type CompletedRecommendation,
  type FinanceTransaction,
  type LocalizedText,
  type Money,
  type SavedPlan,
  type SavingsGoal,
  type SpendingPriority,
  type TransactionSource,
  type WhatIfInputs,
  type WhatIfOutcome,
} from '../engine/index.ts';
import type { PersistedState } from './appState.ts';

/** One versioned key for all app-side state; bump the version when the shape changes incompatibly. */
export const STORAGE_KEY = 'algi.app-state';
export const STORAGE_VERSION = 1;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Returns undefined when the stored value isn't valid, so the field falls back to its default. */
type Decoder<T> = (value: unknown) => T | undefined;
type Shape<T> = { readonly [K in keyof T]-?: Decoder<T[K]> };
/** Without `-?`, so `PERSISTED_FIELDS[key]` keeps the decoder type of its key `K`. */
type PersistedFields = { readonly [K in keyof PersistedState]: Decoder<PersistedState[K]> };

/** The persisted fields that decode; anything missing, corrupt or from another version is left out. */
export function loadPersistedState(storage: StorageLike | null): Partial<PersistedState> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored) || stored.version !== STORAGE_VERSION || !isRecord(stored.state)) return {};
    const fields = stored.state;
    const result: Partial<PersistedState> = {};
    for (const key of PERSISTED_KEYS) decodeField(result, key, fields[key]);
    return result;
  } catch {
    return {};
  }
}

/** Writes the persisted fields; storage being full or blocked never breaks the app. */
export function savePersistedState(storage: StorageLike | null, state: PersistedState): void {
  if (!storage) return;
  try {
    const persisted = Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]]));
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state: persisted }));
  } catch {
    // Private mode or a full quota: keep working in memory.
  }
}

function decodeField<K extends keyof PersistedState>(target: Partial<PersistedState>, key: K, raw: unknown): void {
  const decoded = PERSISTED_FIELDS[key](raw);
  if (decoded !== undefined) target[key] = decoded;
}

// Primitive decoders

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const decodeString: Decoder<string> = (value) => (typeof value === 'string' ? value : undefined);

const decodeBoolean: Decoder<boolean> = (value) => (typeof value === 'boolean' ? value : undefined);

const decodeNumber: Decoder<number> = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const decodeDate: Decoder<Date> = (value) => {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

function decodeOneOf<T extends string>(allowed: readonly T[]): Decoder<T> {
  return (value) => allowed.find((option) => option === value);
}

function decodeNullable<T>(decode: Decoder<T>): Decoder<T | null> {
  return (value) => (value === null ? null : decode(value));
}

/** Keeps the items that decode and drops the rest, so one bad record doesn't lose the whole list. */
function decodeArray<T>(decode: Decoder<T>): Decoder<T[]> {
  return (value) => {
    if (!Array.isArray(value)) return undefined;
    return value.flatMap((item) => {
      const decoded = decode(item);
      return decoded === undefined ? [] : [decoded];
    });
  };
}

function decodeObject<T>(shape: Shape<T>): Decoder<T> {
  return (value) => {
    if (!isRecord(value)) return undefined;
    const result: Partial<Record<keyof T, unknown>> = {};
    for (const key of Object.keys(shape) as (keyof T)[]) {
      const decoded = shape[key](value[String(key)]);
      if (decoded === undefined) return undefined;
      result[key] = decoded;
    }
    // Every key of the shape decoded above, so the result has T's full shape.
    return result as unknown as T;
  };
}

/** A string-keyed record whose keys and values both validate; invalid entries are dropped. */
function decodeRecord<V>(isValidKey: (key: string) => boolean, decodeValue: Decoder<V>): Decoder<Record<string, V>> {
  return (value) => {
    if (!isRecord(value)) return undefined;
    const result: Record<string, V> = {};
    for (const [key, rawValue] of Object.entries(value)) {
      const decoded = decodeValue(rawValue);
      if (isValidKey(key) && decoded !== undefined) result[key] = decoded;
    }
    return result;
  };
}

// Domain decoders

const decodeMoney = decodeObject<Money>({
  minorUnits: (value) => (typeof value === 'number' && Number.isInteger(value) ? value : undefined),
  currency: decodeOneOf(CURRENCIES),
});

const decodeLocalizedText = decodeObject<LocalizedText>({ en: decodeString, ka: decodeString });

const decodeCategory = decodeOneOf<SpendingCategoryId>(SPENDING_CATEGORIES);

const decodeGoal = decodeObject<SavingsGoal>({
  id: decodeString,
  name: decodeLocalizedText,
  icon: decodeOneOf(GOAL_ICONS),
  target: decodeMoney,
  saved: decodeMoney,
  targetDate: decodeDate,
  monthlyContribution: decodeMoney,
  priority: decodeOneOf(GOAL_PRIORITIES),
});

/** Only manual and receipt entries are persisted; bank transactions always come fresh from TBC. */
const decodeManualSource: Decoder<TransactionSource> = (value) => {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'manual') return { kind: 'manual' };
  if (value.kind === 'receipt') return { kind: 'receipt' };
  return undefined;
};

const decodeTransaction = decodeObject<FinanceTransaction>({
  id: decodeString,
  merchant: decodeString,
  category: decodeCategory,
  amount: decodeMoney,
  direction: decodeOneOf(['expense', 'income'] as const),
  date: decodeDate,
  source: decodeManualSource,
  hasReceipt: decodeBoolean,
  isPending: decodeBoolean,
});

const decodeWhatIfInputs = decodeObject<WhatIfInputs>({
  deliveryCut: decodeMoney,
  goalContribution: decodeMoney,
  incomeChangePercent: decodeNumber,
  extraLoanPayment: decodeMoney,
});

const decodeWhatIfOutcome = decodeObject<WhatIfOutcome>({
  roomLeft: decodeMoney,
  goalMonthly: decodeMoney,
  goalCompletion: decodeNullable(decodeDate),
  savedInTwelveMonths: decodeMoney,
  loanMonthsLeft: decodeNumber,
  loanInterestLeft: decodeMoney,
});

const decodeSavedPlan = decodeObject<SavedPlan>({
  id: decodeString,
  name: decodeString,
  inputs: decodeWhatIfInputs,
  outcome: decodeWhatIfOutcome,
});

const decodeCompletedRecommendation = decodeObject<CompletedRecommendation>({
  id: decodeString,
  title: decodeLocalizedText,
  saved: decodeMoney,
  date: decodeDate,
});

const PERSISTED_FIELDS: PersistedFields = {
  language: decodeOneOf(APP_LANGUAGES),
  displayCurrency: decodeOneOf(CURRENCIES),
  objective: decodeOneOf(FINANCIAL_OBJECTIVES),
  savingsTarget: decodeNullable(decodeMoney),
  hasCompletedOnboarding: decodeBoolean,
  plan: decodeOneOf(['free', 'premium'] as const),
  aiUsage: decodeObject({ month: decodeString, used: decodeNumber }),
  goals: decodeArray(decodeGoal),
  manualTransactions: decodeArray(decodeTransaction),
  categoryOverrides: decodeRecord(() => true, decodeCategory),
  priorityOverrides: decodeRecord((key) => decodeCategory(key) !== undefined, decodeOneOf<SpendingPriority>(SPENDING_PRIORITIES)),
  hasReviewedBudget: decodeBoolean,
  hasComparedLoan: decodeBoolean,
  completedLessons: decodeArray(decodeOneOf(LESSONS)),
  savedPlans: decodeArray(decodeSavedPlan),
  completedRecommendations: decodeArray(decodeCompletedRecommendation),
  deliveryMonthlyBudget: decodeMoney,
  upcomingDeliveryBudget: decodeNullable(decodeObject({ amount: decodeMoney, effectiveMonth: decodeString })),
  notifications: decodeObject({
    weeklyPlan: decodeBoolean,
    budgetNudges: decodeBoolean,
    goalMilestones: decodeBoolean,
    productNews: decodeBoolean,
  }),
  permissions: decodeObject({
    useTransactionsForCoaching: decodeBoolean,
    personalizedNudges: decodeBoolean,
    anonymousAnalytics: decodeBoolean,
  }),
};

export const PERSISTED_KEYS = Object.keys(PERSISTED_FIELDS) as (keyof PersistedState)[];
