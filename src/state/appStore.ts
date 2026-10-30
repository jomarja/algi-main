import type { BankConnectionStatus, BankLoan, BankSnapshot, CurrencyCode } from '../../shared/bank.ts';
import type { CoachAppContext, CoachFinanceSummary } from '../../shared/coach.ts';
import {
  add,
  addMonths,
  AVERAGE_DAYS_PER_MONTH,
  CATEGORY_META,
  CoachScript,
  createDisplay,
  currentLoanTerms,
  DailyAllowance,
  deriveBankData,
  divide,
  FinanceSummary,
  FREE_MONTHLY_AI_RECOMMENDATIONS,
  GOAL_KIND_META,
  goalRequestDisplayName,
  InsightBuilder,
  intervalContains,
  isoDay,
  LoanCalculator,
  majorUnits,
  mapAccounts,
  mapTransactions,
  mergeTransactions,
  monthInterval,
  monthKey,
  MonthlyBudget,
  newId,
  ProactiveCoach,
  refinanceOffer,
  RewardsBuilder,
  SAMPLE_PROFILE,
  sampleConverter,
  startOfDay,
  startOfMonth,
  sum,
  zero,
  type Account,
  type AppLanguage,
  type BankDerivedData,
  type CoachQuestion,
  type CurrencyConverter,
  type DataPermissions,
  type Display,
  type FinanceTransaction,
  type FinancialObjective,
  type GoalPlan,
  type GoalRequest,
  type Lesson,
  type LoanComparison,
  type LoanTerms,
  type Money,
  type NotificationPreferences,
  type PersonalInfo,
  type SavedPlan,
  type SavingsGoal,
  type SpendingCategoryId,
  type SpendingHistory,
  type SpendingPriority,
  type SubscriptionPlan,
  type UpcomingPayment,
  type WhatIfInputs,
  type WhatIfOutcome,
} from '../engine/index.ts';
import {
  defaultPersistedState,
  INITIAL_BANK_STATE,
  onboardingDefaults,
  type AppState,
  type BankState,
} from './appState.ts';
import type { BankApi } from './bankApi.ts';
import { loadPersistedState, PERSISTED_KEYS, savePersistedState, type StorageLike } from './persistence.ts';

export interface AppStoreOptions {
  /** Where app-side state persists; null keeps everything in memory (tests, blocked storage). */
  readonly storage?: StorageLike | null;
  /** The clock every "now" comes from; tests pass a fixed date. */
  readonly clock?: () => Date;
  readonly converter?: CurrencyConverter;
}

const NO_LOANS: readonly BankLoan[] = [];

/**
 * The single source of truth for the app, framework-agnostic: subscribe to changes, read the immutable
 * state with `getState()`, call actions to change it, and read derived figures from the getters.
 * Bank data comes from TBC through `BankApi` and is never persisted; app-side state persists to storage.
 */
export class AppStore {
  readonly converter: CurrencyConverter;
  private readonly bankApi: BankApi;
  private readonly storage: StorageLike | null;
  private readonly clock: () => Date;
  private readonly listeners = new Set<() => void>();
  private state: AppState;
  /** Only the latest bank request may write its result, so a slow response can't overwrite a newer one. */
  private latestBankRequest = 0;

  private readonly accountsOf = memoizeOne((snapshot: BankSnapshot | null): Account[] =>
    snapshot ? mapAccounts(snapshot.accounts) : [],
  );
  private readonly bankTransactionsOf = memoizeOne((snapshot: BankSnapshot | null): FinanceTransaction[] =>
    snapshot ? mapTransactions(snapshot) : [],
  );
  private readonly mergedTransactions = memoizeOne(mergeTransactions);
  /** Derived per calendar day: none of these figures change within a day unless the data does. */
  private readonly bankDataOf = memoizeOne(
    (transactions: readonly FinanceTransaction[], loans: readonly BankLoan[], dayStart: number): BankDerivedData =>
      deriveBankData(transactions, loans, new Date(dayStart), this.converter),
  );
  private readonly loanOf = memoizeOne((loans: readonly BankLoan[]) => currentLoanTerms(loans, this.converter));

  constructor(bankApi: BankApi, options: AppStoreOptions = {}) {
    this.bankApi = bankApi;
    this.storage = options.storage ?? null;
    this.clock = options.clock ?? (() => new Date());
    this.converter = options.converter ?? sampleConverter;
    this.state = {
      ...defaultPersistedState(this.clock()),
      ...loadPersistedState(this.storage),
      personalInfo: null,
      pendingCoachQuestion: null,
      bank: INITIAL_BANK_STATE,
    };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getState = (): AppState => this.state;

  // Context

  get now(): Date {
    return this.clock();
  }

  get display(): Display {
    return createDisplay(this.state.language, this.state.displayCurrency, this.converter);
  }

  get isBankConnected(): boolean {
    return this.state.bank.status?.connected ?? false;
  }

  // Data

  get accounts(): readonly Account[] {
    return this.accountsOf(this.state.bank.snapshot);
  }

  /** Bank and manual transactions, with the user's category corrections applied. */
  get transactions(): readonly FinanceTransaction[] {
    const { bank, manualTransactions, categoryOverrides } = this.state;
    return this.mergedTransactions(this.bankTransactionsOf(bank.snapshot), manualTransactions, categoryOverrides);
  }

  get hasFinancialData(): boolean {
    return this.transactions.length > 0;
  }

  /** Income, payday, bills, history and the typical month, derived from the transaction history. */
  get bankData(): BankDerivedData {
    return this.bankDataOf(this.transactions, this.loans, startOfDay(this.now).getTime());
  }

  /** Expected monthly income (the recurring salary), as opposed to `finance.monthlyIncome` received so far. */
  get monthlyIncome(): Money {
    return this.bankData.monthlyIncome;
  }

  get nextPayday(): Date | null {
    return this.bankData.nextPayday;
  }

  get history(): SpendingHistory {
    return this.bankData.history;
  }

  /** Known payments before the next payday, soonest first. */
  get upcomingPayments(): readonly UpcomingPayment[] {
    return this.bankData.upcomingPayments;
  }

  /** The next payment the plan has already set aside money for. */
  get nextEssentialPayment(): UpcomingPayment | null {
    const budget = this.budget;
    return this.upcomingPayments.find((payment) => budget.priority(payment.category) === 'essential') ?? null;
  }

  // Plans

  get primaryGoal(): SavingsGoal | null {
    const { goals } = this.state;
    return goals.find((goal) => goal.priority === 'high') ?? goals[0] ?? null;
  }

  get budget(): MonthlyBudget {
    return this.budgetExcludingGoal(null);
  }

  /** The budget as if one goal's contribution were free again, so a plan for that goal can replace it. */
  budgetExcludingGoal(goalId: string | null): MonthlyBudget {
    const contributions = this.state.goals.filter((goal) => goal.id !== goalId).map((goal) => goal.monthlyContribution);
    return new MonthlyBudget({
      income: this.monthlyIncome,
      lines: this.bankData.typicalMonthlySpending,
      savingsContributions: sum(contributions, 'GEL'),
      priorities: this.state.priorityOverrides,
    });
  }

  /** This month's delivery budget; a revised one applies from the month it was set for. */
  get deliveryMonthlyBudget(): Money {
    const upcoming = this.state.upcomingDeliveryBudget;
    return upcoming && monthKey(this.now) >= upcoming.effectiveMonth ? upcoming.amount : this.state.deliveryMonthlyBudget;
  }

  get finance(): FinanceSummary {
    const budget = this.budget;
    return new FinanceSummary({
      accounts: this.accounts,
      transactions: this.transactions,
      monthlyPlan: budget.monthlyPlan,
      weeklyPlan: budget.weeklyPlan,
      deliveryMonthlyBudget: this.deliveryMonthlyBudget,
      now: this.now,
      converter: this.converter,
    });
  }

  get allowance(): DailyAllowance {
    const finance = this.finance;
    return new DailyAllowance({
      weeklyRemaining: finance.safeToSpendThisWeek,
      daysLeft: finance.daysLeftInWeek,
      essentialDailyNeed: divide(this.budget.dayToDayEssentialTotal, AVERAGE_DAYS_PER_MONTH),
      monthlyGoalContribution: this.primaryGoal?.monthlyContribution ?? zero('GEL'),
    });
  }

  // Loans

  /** The largest TBC loan as loan terms; null when the bank reports none. */
  get currentLoan(): LoanTerms | null {
    return this.loanOf(this.loans);
  }

  get loanOffer(): LoanTerms | null {
    const loan = this.currentLoan;
    return loan ? refinanceOffer(loan.principal) : null;
  }

  get loanComparison(): LoanComparison | null {
    const loan = this.currentLoan;
    const offer = this.loanOffer;
    return loan && offer ? LoanCalculator.compare(loan, offer) : null;
  }

  // Progress

  get rewards(): RewardsBuilder {
    const { goals, hasReviewedBudget, hasComparedLoan, completedLessons } = this.state;
    return new RewardsBuilder({
      goals,
      // TBC's loan data has no original amount, so "loan half repaid" can't be measured yet.
      originalLoanPrincipal: null,
      loanRemaining: this.currentLoan?.principal ?? null,
      savingStreakMonths: this.history.savingStreakMonths,
      hasReviewedBudget,
      hasComparedLoan,
      completedLessons,
    });
  }

  /** Kept by following Luka's recommendations this month. */
  get savedViaRecommendationsThisMonth(): Money {
    const month = monthInterval(this.now);
    const saved = this.state.completedRecommendations
      .filter((recommendation) => intervalContains(month, recommendation.date))
      .map((recommendation) => recommendation.saved);
    return sum(saved, 'GEL');
  }

  // AI usage

  get aiRecommendationsUsed(): number {
    const { aiUsage } = this.state;
    return aiUsage.month === monthKey(this.now) ? aiUsage.used : 0;
  }

  get remainingFreeAIRecommendations(): number {
    return Math.max(FREE_MONTHLY_AI_RECOMMENDATIONS - this.aiRecommendationsUsed, 0);
  }

  /** Whether the coach may give another personalized answer under the current plan. */
  get canUsePersonalizedAI(): boolean {
    return this.state.plan === 'premium' || this.remainingFreeAIRecommendations > 0;
  }

  // Coach

  proactiveCoach(display: Display = this.display): ProactiveCoach {
    return new ProactiveCoach({
      finance: this.finance,
      budget: this.budget,
      goals: this.state.goals,
      upcomingPayments: this.upcomingPayments,
      loanComparison: this.loanComparison,
      display,
      history: this.history,
    });
  }

  /** Luka's scripted answers, for when the AI coach is offline. */
  coachScript(display: Display = this.display): CoachScript {
    return new CoachScript(this.finance, this.primaryGoal, display, this.history);
  }

  insights(display: Display = this.display): InsightBuilder {
    return new InsightBuilder(this.finance, display, this.history);
  }

  /**
   * What the AI coach request carries (shared/coach.ts). Amounts are in the display currency's major
   * units; the summary is left out when the user turned off using transactions for coaching.
   * Personal information is never included.
   */
  coachContext(screen: string): CoachAppContext {
    const { language, displayCurrency, objective, goals, permissions } = this.state;
    const display = this.display;
    const inDisplayCurrency = (value: Money) => majorUnits(this.converter.convert(value, displayCurrency));
    return {
      language,
      displayCurrency,
      userFirstName: display.text(SAMPLE_PROFILE.firstName),
      objective,
      goals: goals.map((goal) => ({
        name: display.text(goal.name),
        target: inDisplayCurrency(goal.target),
        saved: inDisplayCurrency(goal.saved),
        targetDate: isoDay(goal.targetDate),
        monthlyContribution: inDisplayCurrency(goal.monthlyContribution),
        priority: goal.priority,
      })),
      summary: permissions.useTransactionsForCoaching && this.hasFinancialData ? this.coachSummary(inDisplayCurrency) : null,
      screen,
    };
  }

  private coachSummary(inDisplayCurrency: (value: Money) => number): CoachFinanceSummary {
    const finance = this.finance;
    const budget = this.budget;
    const typical = new Map(budget.lines.map((line) => [line.category, line.monthlyAmount]));
    return {
      monthlyIncome: inDisplayCurrency(budget.income),
      monthlySpending: inDisplayCurrency(finance.monthlySpending),
      monthlyPlan: inDisplayCurrency(finance.monthlyPlan),
      remainingThisMonth: inDisplayCurrency(finance.monthlyPlanProgress.remaining),
      safeToSpendToday: inDisplayCurrency(this.allowance.today),
      topCategories: finance
        .categoryTotals(finance.currentMonth)
        .slice(0, 5)
        .map(({ category, total }) => {
          const typicalAmount = typical.get(category);
          return { category, spent: inDisplayCurrency(total), budget: typicalAmount ? inDisplayCurrency(typicalAmount) : null };
        }),
    };
  }

  // Settings and onboarding

  setLanguage(language: AppLanguage): void {
    this.update({ language });
  }

  setDisplayCurrency(displayCurrency: CurrencyCode): void {
    this.update({ displayCurrency });
  }

  setObjective(objective: FinancialObjective): void {
    this.update({ objective });
  }

  setSavingsTarget(savingsTarget: Money | null): void {
    this.update({ savingsTarget });
  }

  setPersonalInfo(personalInfo: PersonalInfo | null): void {
    this.update({ personalInfo });
  }

  setNotifications(notifications: NotificationPreferences): void {
    this.update({ notifications });
  }

  setPermissions(permissions: DataPermissions): void {
    this.update({ permissions });
  }

  completeOnboarding(): void {
    this.update({ hasCompletedOnboarding: true });
  }

  /** Starts over with the starter goals; settings stay, and the bank connection is left as it is. */
  restartOnboarding(): void {
    this.update({ ...onboardingDefaults(this.now), personalInfo: null, pendingCoachQuestion: null });
  }

  // Plan and AI usage

  setPlan(plan: SubscriptionPlan): void {
    this.update({ plan });
  }

  recordPersonalizedAIAnswer(): void {
    if (this.state.plan !== 'free') return;
    this.update({ aiUsage: { month: monthKey(this.now), used: this.aiRecommendationsUsed + 1 } });
  }

  // Goals

  addGoal(goal: SavingsGoal): void {
    this.update({ goals: [...this.state.goals, goal] });
  }

  updateGoal(goal: SavingsGoal): void {
    this.updateGoals(goal.id, () => goal);
  }

  removeGoal(goalId: string): void {
    this.update({ goals: this.state.goals.filter((goal) => goal.id !== goalId) });
  }

  /** Adds money to a goal. */
  contribute(amount: Money, goalId: string): void {
    this.updateGoals(goalId, (goal) => ({ ...goal, saved: add(goal.saved, amount) }));
  }

  /** Turns a chosen plan into a journey: updates the goal it came from, or starts a new one. */
  applyPlan(plan: GoalPlan, request: GoalRequest, amount: Money): string {
    const existing = request.goalId ? this.state.goals.find((goal) => goal.id === request.goalId) : undefined;
    if (existing) {
      this.updateGoals(existing.id, (goal) => ({
        ...goal,
        monthlyContribution: plan.monthlySaving,
        targetDate: plan.completionDate,
      }));
      return existing.id;
    }
    const goal: SavingsGoal = {
      id: newId(),
      name: goalRequestDisplayName(request),
      icon: GOAL_KIND_META[request.kind].icon,
      target: add(amount, request.alreadySaved),
      saved: request.alreadySaved,
      targetDate: plan.completionDate,
      monthlyContribution: plan.monthlySaving,
      priority: 'medium',
    };
    this.addGoal(goal);
    return goal.id;
  }

  // Transactions and budget choices

  /** Records a cash or receipt transaction; bank balances stay as TBC reports them. */
  addTransaction(transaction: FinanceTransaction): void {
    this.update({ manualTransactions: [...this.state.manualTransactions, transaction] });
  }

  updateCategory(transactionId: string, category: SpendingCategoryId): void {
    this.update({ categoryOverrides: { ...this.state.categoryOverrides, [transactionId]: category } });
  }

  /** Records the user's choice; categories that are always protected stay essential. */
  setPriority(priority: SpendingPriority, category: SpendingCategoryId): void {
    const meta = CATEGORY_META[category];
    if (meta.isAlwaysProtected) return;
    const priorityOverrides: Partial<Record<SpendingCategoryId, SpendingPriority>> = { ...this.state.priorityOverrides };
    // Choosing the default again removes the override, so a later change of default applies.
    if (priority === meta.defaultPriority) delete priorityOverrides[category];
    else priorityOverrides[category] = priority;
    this.update({ priorityOverrides, hasReviewedBudget: true });
  }

  markBudgetReviewed(): void {
    this.update({ hasReviewedBudget: true });
  }

  markLoanCompared(): void {
    this.update({ hasComparedLoan: true });
  }

  /** Saves a revised delivery budget that starts next month. */
  setUpcomingDeliveryBudget(amount: Money): void {
    const effectiveMonth = monthKey(addMonths(startOfMonth(this.now), 1));
    this.update({ upcomingDeliveryBudget: { amount, effectiveMonth } });
  }

  // What-if plans and lessons

  savePlan(inputs: WhatIfInputs, outcome: WhatIfOutcome, name: string): SavedPlan {
    const plan: SavedPlan = { id: newId(), name, inputs, outcome };
    this.update({ savedPlans: [...this.state.savedPlans, plan] });
    return plan;
  }

  removePlan(planId: string): void {
    this.update({ savedPlans: this.state.savedPlans.filter((plan) => plan.id !== planId) });
  }

  completeLesson(lesson: Lesson): void {
    if (this.state.completedLessons.includes(lesson)) return;
    this.update({ completedLessons: [...this.state.completedLessons, lesson] });
  }

  // Coach navigation

  /** Asks the coach a question; the coach screen answers it when it opens and then clears it. */
  askCoach(question: CoachQuestion): void {
    this.update({ pendingCoachQuestion: question });
  }

  clearPendingCoachQuestion(): void {
    this.update({ pendingCoachQuestion: null });
  }

  // Bank

  /** Checks the connection and loads the latest data. Call at startup and after returning from TBC. */
  async loadBank(): Promise<void> {
    const request = this.beginBankRequest();
    try {
      const status = await this.bankApi.status();
      const snapshot = status.connected ? await this.bankApi.snapshot() : null;
      if (this.isLatestBankRequest(request)) this.updateBank({ status, snapshot, sync: 'idle', error: null });
    } catch (error) {
      this.failBankRequest(request, error);
    }
  }

  /** Starts the TBC consent and returns the page to send the user to. Rejects when that fails. */
  async connectBank(): Promise<string> {
    const request = this.beginBankRequest();
    try {
      const { authorizeUrl } = await this.bankApi.connect(this.state.language);
      if (this.isLatestBankRequest(request)) this.updateBank({ sync: 'idle', error: null });
      return authorizeUrl;
    } catch (error) {
      this.failBankRequest(request, error);
      throw error;
    }
  }

  /**
   * Pull to refresh: re-fetches from TBC and returns the transactions that weren't in the previous data,
   * so the screen can celebrate them or say "You're all caught up". Failures land in `bank.sync`.
   */
  async refreshBank(): Promise<FinanceTransaction[]> {
    const request = this.beginBankRequest();
    const known = new Set(this.state.bank.snapshot?.transactions.map((transaction) => transaction.id) ?? []);
    try {
      const snapshot = await this.bankApi.snapshot(true);
      if (!this.isLatestBankRequest(request)) return [];
      this.updateBank({ status: statusAfterSync(snapshot), snapshot, sync: 'idle', error: null });
      return mapTransactions(snapshot).filter((transaction) => !known.has(transaction.id));
    } catch (error) {
      this.failBankRequest(request, error);
      return [];
    }
  }

  /** Deletes the consent at TBC and forgets the bank data. */
  async disconnectBank(): Promise<void> {
    const request = this.beginBankRequest();
    try {
      await this.bankApi.disconnect();
      if (!this.isLatestBankRequest(request)) return;
      const { status } = this.state.bank;
      this.updateBank({
        status: status ? { ...status, connected: false, consent: null, lastSyncedAt: null } : null,
        snapshot: null,
        sync: 'idle',
        error: null,
      });
    } catch (error) {
      this.failBankRequest(request, error);
    }
  }

  // Internals

  private get loans(): readonly BankLoan[] {
    return this.state.bank.snapshot?.loans ?? NO_LOANS;
  }

  private beginBankRequest(): number {
    this.latestBankRequest += 1;
    this.updateBank({ sync: 'loading', error: null });
    return this.latestBankRequest;
  }

  private isLatestBankRequest(request: number): boolean {
    return request === this.latestBankRequest;
  }

  private failBankRequest(request: number, error: unknown): void {
    if (!this.isLatestBankRequest(request)) return;
    this.updateBank({ sync: 'error', error: error instanceof Error ? error.message : String(error) });
  }

  private updateBank(changes: Partial<BankState>): void {
    this.update({ bank: { ...this.state.bank, ...changes } });
  }

  private updateGoals(goalId: string, change: (goal: SavingsGoal) => SavingsGoal): void {
    this.update({ goals: this.state.goals.map((goal) => (goal.id === goalId ? change(goal) : goal)) });
  }

  private update(changes: Partial<AppState>): void {
    this.state = { ...this.state, ...changes };
    if (PERSISTED_KEYS.some((key) => key in changes)) savePersistedState(this.storage, this.state);
    for (const listener of this.listeners) listener();
  }
}

/** A store that persists to the browser's localStorage and uses the real clock. */
export function createAppStore(bankApi: BankApi): AppStore {
  return new AppStore(bankApi, { storage: browserStorage() });
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Accessing localStorage throws when the browser blocks site data.
    return null;
  }
}

/** A successful fetch means the consent works; the snapshot carries its details. */
function statusAfterSync(snapshot: BankSnapshot): BankConnectionStatus {
  return { connected: true, source: snapshot.source, consent: snapshot.consent, lastSyncedAt: snapshot.fetchedAt };
}

/** Caches the last result while the arguments are the same objects. */
function memoizeOne<Args extends readonly unknown[], Result>(compute: (...args: Args) => Result): (...args: Args) => Result {
  let cache: { readonly args: Args; readonly result: Result } | null = null;
  return (...args) => {
    if (cache && cache.args.length === args.length && cache.args.every((arg, index) => Object.is(arg, args[index]))) {
      return cache.result;
    }
    const result = compute(...args);
    cache = { args, result };
    return result;
  };
}
