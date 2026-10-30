import { describe, expect, it } from 'vitest';
import type { BankConnectionStatus, BankSnapshot } from '../../shared/bank.ts';
import {
  FREE_MONTHLY_AI_RECOMMENDATIONS,
  gel,
  goalRequest,
  GoalPlanner,
  isEarned,
  LESSONS,
  manualTransaction,
  replanningRequest,
  tbilisiDate,
  usd,
  WhatIfSimulator,
  zero,
} from '../engine/index.ts';
import { FIXTURE_NOW, FREELANCE_PAYMENT, sampleSnapshot } from '../engine/testFixtures.ts';
import { AppStore } from './appStore.ts';
import type { BankApi } from './bankApi.ts';
import { STORAGE_KEY, STORAGE_VERSION, type StorageLike } from './persistence.ts';

class FakeBankApi implements BankApi {
  data: BankSnapshot | null;
  error: Error | null = null;
  refreshRequests = 0;
  disconnected = false;

  constructor(data: BankSnapshot | null) {
    this.data = data;
  }

  async status(): Promise<BankConnectionStatus> {
    this.failIfAsked();
    return {
      connected: this.data !== null,
      source: 'mock',
      consent: this.data?.consent ?? null,
      lastSyncedAt: this.data?.fetchedAt ?? null,
    };
  }

  async connect(language: 'en' | 'ka'): Promise<{ authorizeUrl: string }> {
    this.failIfAsked();
    return { authorizeUrl: `/mock-tbc/authorize?lang=${language}` };
  }

  async snapshot(refresh = false): Promise<BankSnapshot> {
    this.failIfAsked();
    if (refresh) this.refreshRequests += 1;
    if (!this.data) throw new Error('not_connected');
    return this.data;
  }

  async disconnect(): Promise<void> {
    this.failIfAsked();
    this.disconnected = true;
    this.data = null;
  }

  private failIfAsked(): void {
    if (this.error) throw this.error;
  }
}

class MemoryStorage implements StorageLike {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function store(api: BankApi = new FakeBankApi(sampleSnapshot()), storage: StorageLike | null = null, clock = () => FIXTURE_NOW): AppStore {
  return new AppStore(api, { storage, clock });
}

async function connectedStore(api = new FakeBankApi(sampleSnapshot())): Promise<AppStore> {
  const connected = store(api);
  await connected.loadBank();
  return connected;
}

/** The sample snapshot after the freelance payment landed in the everyday account. */
function snapshotWithFreelancePayment(): BankSnapshot {
  const base = sampleSnapshot();
  return {
    ...base,
    accounts: base.accounts.map((account) => (account.kind === 'current' ? { ...account, balance: account.balance + 250 } : account)),
    transactions: [FREELANCE_PAYMENT, ...base.transactions],
  };
}

describe('AppStore: plan and AI limits', () => {
  it('counts personalized answers on the free plan', () => {
    const state = store();
    state.recordPersonalizedAIAnswer();
    expect(state.aiRecommendationsUsed).toBe(FREE_MONTHLY_AI_RECOMMENDATIONS - 1);
    expect(state.canUsePersonalizedAI).toBe(true);

    state.recordPersonalizedAIAnswer();
    expect(state.remainingFreeAIRecommendations).toBe(0);
    expect(state.canUsePersonalizedAI).toBe(false);
  });

  it('premium is not limited', () => {
    const state = store();
    state.setPlan('premium');
    for (let answer = 0; answer < 10; answer += 1) state.recordPersonalizedAIAnswer();
    expect(state.aiRecommendationsUsed).toBe(3);
    expect(state.canUsePersonalizedAI).toBe(true);
  });

  it('starts every month with the full free allowance', () => {
    let now = FIXTURE_NOW;
    const state = store(undefined, null, () => now);
    state.recordPersonalizedAIAnswer();
    state.recordPersonalizedAIAnswer();
    expect(state.canUsePersonalizedAI).toBe(false);

    now = tbilisiDate(2026, 11, 2, 9, 0);
    expect(state.aiRecommendationsUsed).toBe(0);
    expect(state.remainingFreeAIRecommendations).toBe(FREE_MONTHLY_AI_RECOMMENDATIONS);
  });
});

describe('AppStore: bank connection', () => {
  it('loads accounts, transactions and status from TBC', async () => {
    const state = await connectedStore();
    expect(state.isBankConnected).toBe(true);
    expect(state.accounts).toHaveLength(2);
    expect(state.finance.totalBalance).toEqual(gel(17_336.4));
    expect(state.getState().bank.sync).toBe('idle');
  });

  it('without a bank connection the app is empty', async () => {
    const state = store(new FakeBankApi(null));
    await state.loadBank();
    state.completeOnboarding();
    expect(state.getState().hasCompletedOnboarding).toBe(true);
    expect(state.isBankConnected).toBe(false);
    expect(state.hasFinancialData).toBe(false);
    expect(state.finance.accounts).toEqual([]);
    expect(state.upcomingPayments).toEqual([]);
    expect(state.currentLoan).toBeNull();
  });

  it('returns the authorize URL for the chosen language', async () => {
    const state = store(new FakeBankApi(null));
    state.setLanguage('ka');
    await expect(state.connectBank()).resolves.toBe('/mock-tbc/authorize?lang=ka');
    expect(state.getState().bank.sync).toBe('idle');
  });

  it('reports a failed connection and rejects', async () => {
    const api = new FakeBankApi(null);
    api.error = new Error('consent_failed');
    const state = store(api);
    await expect(state.connectBank()).rejects.toThrow('consent_failed');
    expect(state.getState().bank).toMatchObject({ sync: 'error', error: 'consent_failed' });
  });

  it('refresh delivers new transactions and raises the balance', async () => {
    const api = new FakeBankApi(sampleSnapshot());
    const state = await connectedStore(api);
    const before = state.finance.totalBalance;

    const updated = snapshotWithFreelancePayment();
    api.data = updated;
    const arrived = await state.refreshBank();

    expect(api.refreshRequests).toBe(1);
    expect(arrived.map((transaction) => transaction.merchant)).toEqual(['Freelance payment']);
    expect(state.finance.totalBalance).toEqual(gel(17_586.4));
    expect(state.finance.totalBalance).not.toEqual(before);
    expect(state.transactions.some((transaction) => transaction.id === FREELANCE_PAYMENT.id)).toBe(true);
    expect(state.getState().bank.status?.lastSyncedAt).toBe(updated.fetchedAt);
  });

  it('refresh reports up to date when nothing new arrived', async () => {
    const state = await connectedStore();
    await expect(state.refreshBank()).resolves.toEqual([]);
    expect(state.finance.totalBalance).toEqual(gel(17_336.4));
  });

  it('keeps the last data when a refresh fails', async () => {
    const api = new FakeBankApi(sampleSnapshot());
    const state = await connectedStore(api);
    api.error = new Error('TBC is unavailable');

    await expect(state.refreshBank()).resolves.toEqual([]);
    expect(state.getState().bank).toMatchObject({ sync: 'error', error: 'TBC is unavailable' });
    expect(state.hasFinancialData).toBe(true);
  });

  it('ignores a slower response from an older request', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api: BankApi = {
      status: async () => ({ connected: true, source: 'mock', consent: null, lastSyncedAt: null }),
      connect: async () => ({ authorizeUrl: '/mock-tbc/authorize' }),
      snapshot: async (refresh) => {
        if (refresh) return snapshotWithFreelancePayment();
        await gate;
        return sampleSnapshot();
      },
      disconnect: async () => {},
    };
    const state = store(api);

    const slowLoad = state.loadBank();
    await state.refreshBank();
    release();
    await slowLoad;

    expect(state.transactions.some((transaction) => transaction.id === FREELANCE_PAYMENT.id)).toBe(true);
  });

  it('disconnecting forgets the bank data and its bills', async () => {
    const api = new FakeBankApi(sampleSnapshot());
    const state = await connectedStore(api);
    expect(state.upcomingPayments[0]?.id).toBe('rent');

    await state.disconnectBank();
    expect(api.disconnected).toBe(true);
    expect(state.isBankConnected).toBe(false);
    expect(state.upcomingPayments).toEqual([]);
    expect(state.getState().bank.snapshot).toBeNull();
  });
});

describe('AppStore: transactions and goals', () => {
  it('recategorizes a transaction', async () => {
    const state = await connectedStore();
    const zara = state.transactions.find((transaction) => transaction.merchant === 'Zara');
    if (!zara) throw new Error('The sample data has a Zara purchase');
    state.updateCategory(zara.id, 'health');
    expect(state.transactions.find((transaction) => transaction.id === zara.id)?.category).toBe('health');
  });

  it('adds money to a goal', () => {
    const state = store();
    const goal = state.primaryGoal;
    if (!goal) throw new Error('The starter goals include a primary goal');
    state.contribute(gel(100), goal.id);
    expect(state.getState().goals.find((candidate) => candidate.id === goal.id)?.saved).toEqual(gel(2750));
  });

  it('a manual foreign expense counts as spending but leaves the bank balance alone', async () => {
    const state = await connectedStore();
    state.addTransaction(
      manualTransaction({ merchant: 'App Store', category: 'subscriptions', amount: usd(10), direction: 'expense', date: FIXTURE_NOW }),
    );
    expect(state.finance.monthlySpending).toEqual(gel(2185.97));
    expect(state.finance.totalBalance).toEqual(gel(17_336.4));
  });

  it('manual mode has no accounts but still has data', () => {
    const state = store(new FakeBankApi(null));
    state.addTransaction(
      manualTransaction({ merchant: 'Cash', category: 'income', amount: gel(20), direction: 'income', date: FIXTURE_NOW }),
    );
    expect(state.finance.totalBalance).toEqual(zero('GEL'));
    expect(state.hasFinancialData).toBe(true);
  });

  it('asking the coach leaves the question for the coach screen', () => {
    const state = store();
    state.askCoach('whySpendMore');
    expect(state.getState().pendingCoachQuestion).toBe('whySpendMore');
    state.clearPendingCoachQuestion();
    expect(state.getState().pendingCoachQuestion).toBeNull();
  });

  it('restarting onboarding resets the demo but keeps the bank connection', async () => {
    const state = await connectedStore();
    state.completeOnboarding();
    state.setPlan('premium');
    state.setUpcomingDeliveryBudget(gel(150));
    state.setPersonalInfo({ personalNumber: '01023456789', phoneNumber: '555123456' });
    state.addGoal({ ...state.getState().goals[0], id: 'extra' });
    state.setLanguage('ka');

    state.restartOnboarding();

    const restarted = state.getState();
    expect(restarted.hasCompletedOnboarding).toBe(false);
    expect(restarted.personalInfo).toBeNull();
    expect(restarted.plan).toBe('free');
    expect(restarted.upcomingDeliveryBudget).toBeNull();
    expect(restarted.goals).toHaveLength(3);
    expect(restarted.language).toBe('ka');
    expect(state.hasFinancialData).toBe(true);
  });
});

describe('AppStore: decision intelligence', () => {
  it('derives income, plans and payday from the bank data', async () => {
    const state = await connectedStore();
    expect(state.monthlyIncome).toEqual(gel(3400));
    expect(state.finance.monthlyPlan).toEqual(gel(2400));
    expect(state.finance.weeklyPlan).toEqual(gel(280));
    expect(state.nextPayday).toEqual(tbilisiDate(2026, 11, 28, 0, 0));
    expect(state.nextEssentialPayment?.id).toBe('rent');
  });

  it('builds the allowance from the budget', async () => {
    const state = await connectedStore();
    expect(state.allowance.today).toEqual(gel(30.68));
    expect(state.allowance.essentialDailyNeed).toEqual(gel(14.29));
  });

  it('protected categories cannot be made flexible', () => {
    const state = store();
    state.setPriority('flexible', 'groceries');
    expect(state.budget.priority('groceries')).toBe('essential');
    expect(state.getState().hasReviewedBudget).toBe(false);
  });

  it('changing a priority updates the budget', () => {
    const state = store();
    state.setPriority('flexible', 'transport');
    expect(state.budget.priority('transport')).toBe('flexible');
    expect(state.getState().hasReviewedBudget).toBe(true);

    state.setPriority('essential', 'transport');
    expect(state.getState().priorityOverrides.transport).toBeUndefined();
  });

  it('budget savings follow the goals', () => {
    const state = store();
    expect(state.budget.savingsContributions).toEqual(gel(1000));
    expect(state.budgetExcludingGoal('safety-cushion').savingsContributions).toEqual(gel(550));
  });

  it('choosing a plan starts a new journey', async () => {
    const state = await connectedStore();
    const request = goalRequest('car', gel(15000));
    const planner = new GoalPlanner(state.budget, state.now);
    const [plan] = planner.plans(request);

    const goalId = state.applyPlan(plan, request, planner.amountToSave(request));

    const goal = state.getState().goals.find((candidate) => candidate.id === goalId);
    expect(goal?.target).toEqual(gel(15250));
    expect(goal?.monthlyContribution).toEqual(plan.monthlySaving);
    expect(goal?.icon).toBe('car');
    expect(goal?.name.en).toBe('New car');
    expect(state.getState().goals).toHaveLength(4);
  });

  it('choosing a plan for an existing goal updates it', async () => {
    const state = await connectedStore();
    const goal = state.getState().goals[0];
    const request = replanningRequest(goal, state.now);
    const planner = new GoalPlanner(state.budgetExcludingGoal(goal.id), state.now);
    const [plan] = planner.plans(request);

    state.applyPlan(plan, request, planner.amountToSave(request));

    expect(state.getState().goals).toHaveLength(3);
    expect(state.getState().goals[0].monthlyContribution).toEqual(plan.monthlySaving);
    expect(state.getState().goals[0].targetDate).toEqual(plan.completionDate);
  });

  it('saves and removes what-if plans', async () => {
    const state = await connectedStore();
    const goal = state.primaryGoal;
    if (!goal) throw new Error('The starter goals include a primary goal');
    const simulator = new WhatIfSimulator(state.budget, goal, state.currentLoan, state.now);
    const saved = state.savePlan(simulator.baseline, simulator.outcome(simulator.baseline), 'Plan 1');
    expect(state.getState().savedPlans).toEqual([saved]);

    state.removePlan(saved.id);
    expect(state.getState().savedPlans).toEqual([]);
  });

  it('applies a revised delivery budget from next month', () => {
    let now = FIXTURE_NOW;
    const state = store(undefined, null, () => now);
    state.setUpcomingDeliveryBudget(gel(150));
    expect(state.deliveryMonthlyBudget).toEqual(gel(200));

    now = tbilisiDate(2026, 11, 1, 9, 0);
    expect(state.deliveryMonthlyBudget).toEqual(gel(150));
  });

  it('compares the TBC loan with the refinance offer', async () => {
    const state = await connectedStore();
    expect(state.loanComparison?.verdict).toBe('lowerPaymentLongerCommitment');
    expect(state.loanComparison?.totalDifference).toEqual(gel(1720.85));
  });
});

describe('AppStore: coach and rewards', () => {
  it('ranks the goal at risk first and suggests every relevant action', async () => {
    const state = await connectedStore();
    const ids = state.proactiveCoach().recommendations.map((recommendation) => recommendation.id);
    expect(ids).toEqual([
      'goal-at-risk-safety-cushion',
      'flexible-adjustment',
      'upcoming-rent',
      'loan-offer',
      'goal-ahead-japan-adventure',
      'delivery-trend',
    ]);
  });

  it('answers from the script with the bank figures', async () => {
    const state = await connectedStore();
    expect(state.coachScript().reply('weeklyAllowance').text).toContain('123');
    expect(state.insights().content('deliveryIncrease').summary).toContain('185');
  });

  it('rewards progress rather than low spending', async () => {
    const state = await connectedStore();
    const achievements = new Map(state.rewards.achievements.map((achievement) => [achievement.id, achievement]));
    expect(achievements.get('streak')?.progress).toBe(1);
    expect(achievements.get('essentials')?.progress).toBe(0);
    expect(achievements.get('loan-half')?.progress).toBe(0);
    expect(achievements.get('money-basics')?.progress).toBe(1 / 3);
  });

  it('earns achievements from actions', () => {
    const state = store();
    state.setPriority('flexible', 'transport');
    state.markLoanCompared();
    LESSONS.forEach((lesson) => state.completeLesson(lesson));
    const earned = state.rewards.achievements.filter(isEarned).map((achievement) => achievement.id);
    expect(earned).toEqual(expect.arrayContaining(['essentials', 'loan-detective', 'money-basics']));
  });

  it('totals what following Luka kept this month', () => {
    expect(store().savedViaRecommendationsThisMonth).toEqual(gel(48));
  });

  it('builds the AI coach context without personal information', async () => {
    const state = await connectedStore();
    state.setPersonalInfo({ personalNumber: '01023456789', phoneNumber: '555123456' });
    const context = state.coachContext('/plan/goal');

    expect(context).toMatchObject({ language: 'en', displayCurrency: 'GEL', userFirstName: 'Nino', screen: '/plan/goal' });
    expect(context.goals[0]).toEqual({
      name: 'Safety cushion',
      target: 4000,
      saved: 2650,
      targetDate: '2026-12-31',
      monthlyContribution: 450,
      priority: 'high',
    });
    expect(context.summary).toMatchObject({ monthlyIncome: 3400, monthlySpending: 2158.97, monthlyPlan: 2400, safeToSpendToday: 30.68 });
    expect(JSON.stringify(context)).not.toContain('01023456789');
  });

  it('converts the coach context and respects the coaching permission', async () => {
    const state = await connectedStore();
    state.setDisplayCurrency('USD');
    expect(state.coachContext('/').goals[0].target).toBe(1481.48);

    state.setPermissions({ ...state.getState().permissions, useTransactionsForCoaching: false });
    expect(state.coachContext('/').summary).toBeNull();
  });
});

describe('AppStore: persistence', () => {
  it('restores app-side state but never bank data or personal information', async () => {
    const storage = new MemoryStorage();
    const first = store(new FakeBankApi(sampleSnapshot()), storage);
    await first.loadBank();
    first.setLanguage('ka');
    first.setPersonalInfo({ personalNumber: '01023456789', phoneNumber: '555123456' });
    first.addTransaction(
      manualTransaction(
        { merchant: 'Bazaar', category: 'groceries', amount: gel(20), direction: 'expense', date: FIXTURE_NOW },
        'manual-1',
      ),
    );
    first.updateCategory('manual-1', 'foodAndDrink');
    first.completeLesson('emergencyFund');

    const raw = storage.getItem(STORAGE_KEY) ?? '';
    expect(raw).not.toContain('01023456789');
    expect(raw).not.toContain('Coffee Lab');

    const second = store(new FakeBankApi(null), storage);
    const restored = second.getState();
    expect(restored.language).toBe('ka');
    expect(restored.personalInfo).toBeNull();
    expect(restored.completedLessons).toEqual(['needsVersusWants', 'emergencyFund']);
    expect(restored.manualTransactions[0]?.date).toEqual(FIXTURE_NOW);
    expect(second.transactions[0]?.category).toBe('foodAndDrink');
    expect(restored.goals.map((goal) => goal.targetDate)).toEqual(first.getState().goals.map((goal) => goal.targetDate));
    expect(restored.bank.snapshot).toBeNull();
  });

  it('falls back to defaults for unreadable or outdated storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(store(undefined, storage).getState().language).toBe('en');

    storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION + 1, state: { language: 'ka' } }));
    expect(store(undefined, storage).getState().language).toBe('en');
  });

  it('drops invalid fields and records but keeps the valid ones', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        state: {
          language: 'fr',
          displayCurrency: 'USD',
          completedLessons: ['emergencyFund', 'astrology'],
          priorityOverrides: { transport: 'flexible', crypto: 'flexible', shopping: 'sometimes' },
        },
      }),
    );
    const restored = store(undefined, storage).getState();
    expect(restored.language).toBe('en');
    expect(restored.displayCurrency).toBe('USD');
    expect(restored.completedLessons).toEqual(['emergencyFund']);
    expect(restored.priorityOverrides).toEqual({ transport: 'flexible' });
  });

  it('keeps working when storage refuses to write', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const state = store(undefined, full);
    expect(() => state.setLanguage('ka')).not.toThrow();
    expect(state.getState().language).toBe('ka');
  });

  it('notifies subscribers on every change until they unsubscribe', () => {
    const state = store();
    let notifications = 0;
    const unsubscribe = state.subscribe(() => {
      notifications += 1;
    });
    state.setLanguage('ka');
    unsubscribe();
    state.setLanguage('en');
    expect(notifications).toBe(1);
  });
});
