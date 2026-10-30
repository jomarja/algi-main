import type {
  BankAccount,
  BankConsent,
  BankDataSourceKind,
  BankLoan,
  BankSnapshot,
  BankTransaction,
  CurrencyCode,
  SpendingCategoryId,
} from '../../shared/bank.ts';
import type { CoachAppContext, CoachFinanceSummary, CoachGoal } from '../../shared/coach.ts';
import {
  type AppLanguage,
  type CalendarDay,
  MINUS_SIGN,
  daysBetween,
  formatMoney,
  formatPercent,
  monthOf,
  previousMonth,
  sanitizeForPrompt,
  tbilisiToday,
  wholeMonthsBetween,
} from './format.ts';

/**
 * Builds the per-request data block: a compact, readable picture of the user's money for Luka.
 * It is sent after the cached system prompt, so fresh data never invalidates the cache.
 * Labels stay in English for the model; amounts are formatted in the app language so Luka can quote them.
 */

/** What the bank side returned for this request. */
export type BankData =
  | { status: 'connected'; snapshot: BankSnapshot }
  | { status: 'not_connected' }
  | { status: 'unavailable' };

const listLimits = { accounts: 8, loans: 6, goals: 8, recurring: 8, topCategories: 8, latest: 8, largestExpenses: 5 };
const textLimits = { name: 40, note: 60, short: 60 };

/** "Notable transactions" look back this far. */
const recentDays = 30;
/** A payment counts as recurring when it shows up in at least two months, about once a month, and recently. */
const recurring = { minMonths: 2, maxChargesPerMonth: 1.5, activeWithinDays: 45 };

const languageNames: Record<AppLanguage, string> = { en: 'English (en)', ka: 'Georgian (ka)' };

const sourceNames: Record<BankDataSourceKind, string> = {
  mock: 'demo data from the built-in imitation of TBC Open Banking, not a real account',
  'tbc-sandbox': "TBC Bank's test environment, not a real account",
  'tbc-production': "the user's TBC Bank accounts via open banking",
};

interface Formatter {
  displayCurrency: CurrencyCode;
  /** An amount in its own currency, or in the display currency when none is given. */
  money(amount: number, currency?: CurrencyCode): string;
  percent(value: number): string;
}

export function buildCoachData(bank: BankData, app: CoachAppContext, now: Date): string {
  const today = tbilisiToday(now);
  const format = createFormatter(app);
  return [
    describeRequest(app, today),
    describeBank(bank, today, format),
    describePlan(app.summary, format),
    describeGoals(app.goals, today, format),
  ].join('\n\n');
}

function createFormatter(app: CoachAppContext): Formatter {
  return {
    displayCurrency: app.displayCurrency,
    money: (amount, currency = app.displayCurrency) => formatMoney(amount, currency, app.language),
    percent: (value) => formatPercent(value, app.language),
  };
}

function describeRequest(app: CoachAppContext, today: CalendarDay): string {
  return [
    `Today: ${today.weekday}, ${today.iso} (Asia/Tbilisi)`,
    `App language: ${languageNames[app.language]}`,
    `Display currency: ${app.displayCurrency}`,
    `User's first name: ${sanitizeForPrompt(app.userFirstName, textLimits.name) || 'not given'}`,
    `Main objective: ${sanitizeForPrompt(app.objective, textLimits.short) || 'not given'}`,
    `Screen the user is on: ${sanitizeForPrompt(app.screen, textLimits.short) || 'unknown'}`,
  ].join('\n');
}

// MARK: Bank

function describeBank(bank: BankData, today: CalendarDay, format: Formatter): string {
  switch (bank.status) {
    case 'not_connected':
      return '## Bank\nNo bank account is connected yet, so there are no balances, transactions or loans. The user can connect TBC Bank in the app.';
    case 'unavailable':
      return "## Bank\nBank data couldn't be loaded for this message. Don't guess balances or transactions; the user can refresh or try again later.";
    case 'connected':
      return describeSnapshot(bank.snapshot, today, format);
  }
}

function describeSnapshot(snapshot: BankSnapshot, today: CalendarDay, format: Formatter): string {
  const { transactions } = snapshot;
  return [
    ['## Bank', describeSource(snapshot), describeConsent(snapshot.consent), describeHistory(transactions)].join('\n'),
    describeAccounts(snapshot.accounts, format),
    describeMonthlySpending(transactions, today, format),
    describeRecurringPayments(transactions, today, format),
    describeNotableTransactions(transactions, today, format),
    describeLoans(snapshot.loans, format),
  ].join('\n\n');
}

function describeSource(snapshot: BankSnapshot): string {
  return `Source: ${sourceNames[snapshot.source]}; fetched ${sanitizeForPrompt(snapshot.fetchedAt, textLimits.short)}`;
}

function describeConsent(consent: BankConsent): string {
  if (consent.status === 'valid') return `Consent: valid until ${consent.validUntil}`;
  const status = sanitizeForPrompt(consent.status, textLimits.short);
  return `Consent: ${status} (bank data may be out of date; the user can reconnect TBC Bank in the app)`;
}

function describeHistory(transactions: readonly BankTransaction[]): string {
  if (transactions.length === 0) return 'Transactions: none in the period the bank shared';
  const dates = transactions.map((t) => t.bookingDate).sort();
  const pending = transactions.filter((t) => t.status === 'pending').length;
  const pendingNote = pending > 0 ? `, ${pending} pending` : '';
  return `Transactions: ${transactions.length} from ${dates[0]} to ${dates[dates.length - 1]}${pendingNote}`;
}

function describeAccounts(accounts: readonly BankAccount[], format: Formatter): string {
  if (accounts.length === 0) return 'Accounts: none shared';
  const lines = accounts.slice(0, listLimits.accounts).map((account) => {
    const available = account.available === null ? '' : `, available ${format.money(account.available, account.currency)}`;
    const name = sanitizeForPrompt(account.name, textLimits.name);
    return `- ${name} (${account.kind}): balance ${format.money(account.balance, account.currency)}${available}`;
  });
  return [
    'Accounts:',
    ...lines,
    ...notShown(accounts.length, listLimits.accounts),
    `Total balance: ${totalsByCurrency(accounts, (account) => account.balance, format)}`,
  ].join('\n');
}

interface CategoryMonths {
  category: SpendingCategoryId;
  currency: CurrencyCode;
  thisMonth: number;
  lastMonth: number;
}

function describeMonthlySpending(transactions: readonly BankTransaction[], today: CalendarDay, format: Formatter): string {
  const thisMonth = monthOf(today.iso);
  const lastMonth = previousMonth(thisMonth);
  const expenses = transactions.filter(isExpense);
  const income = transactions.filter((t) => t.direction === 'income');
  const rows = spendingByCategory(expenses, thisMonth, lastMonth);
  const header = `Spending by category (this month = ${thisMonth}-01 to ${today.iso}, so far; last month = ${lastMonth}, the whole month):`;
  const lines = rows.length > 0
    ? rows.map((row) => `- ${row.category}: this month ${format.money(row.thisMonth, row.currency)} · last month ${format.money(row.lastMonth, row.currency)}`)
    : ['- no expenses this month or last month'];
  const total = (items: readonly BankTransaction[], month: string): string =>
    totalsByCurrency(items.filter((t) => monthOf(t.bookingDate) === month), (t) => t.amount, format);
  return [
    header,
    ...lines,
    `Total spending: this month ${total(expenses, thisMonth)} · last month ${total(expenses, lastMonth)}`,
    `Income: this month ${total(income, thisMonth)} · last month ${total(income, lastMonth)}`,
  ].join('\n');
}

function spendingByCategory(expenses: readonly BankTransaction[], thisMonth: string, lastMonth: string): CategoryMonths[] {
  const rows = new Map<string, CategoryMonths>();
  for (const expense of expenses) {
    const month = monthOf(expense.bookingDate);
    if (month !== thisMonth && month !== lastMonth) continue;
    const key = `${expense.category}|${expense.currency}`;
    const row = rows.get(key) ?? { category: expense.category, currency: expense.currency, thisMonth: 0, lastMonth: 0 };
    if (month === thisMonth) row.thisMonth += expense.amount;
    else row.lastMonth += expense.amount;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.thisMonth - a.thisMonth || b.lastMonth - a.lastMonth);
}

interface RecurringPayment {
  latest: BankTransaction;
  months: number;
}

function describeRecurringPayments(transactions: readonly BankTransaction[], today: CalendarDay, format: Formatter): string {
  const payments = findRecurringPayments(transactions.filter(isExpense), today);
  if (payments.length === 0) return 'Recurring payments: none found';
  const lines = payments.map(({ latest, months }) =>
    `- ${sanitizeForPrompt(latest.merchant, textLimits.name)} (${latest.category}): ${format.money(latest.amount, latest.currency)}, last on ${latest.bookingDate}, charged in ${months} months`,
  );
  return ['Recurring payments (about once a month, in two or more months):', ...lines].join('\n');
}

function findRecurringPayments(expenses: readonly BankTransaction[], today: CalendarDay): RecurringPayment[] {
  const byMerchant = new Map<string, BankTransaction[]>();
  for (const expense of expenses) {
    const key = `${expense.merchant.trim().toLowerCase()}|${expense.currency}`;
    const charges = byMerchant.get(key);
    if (charges) charges.push(expense);
    else byMerchant.set(key, [expense]);
  }
  const payments: RecurringPayment[] = [];
  for (const charges of byMerchant.values()) {
    const months = new Set(charges.map((charge) => monthOf(charge.bookingDate))).size;
    const latest = charges.reduce((a, b) => (b.bookingDate > a.bookingDate ? b : a));
    const isMonthly = months >= recurring.minMonths && charges.length <= months * recurring.maxChargesPerMonth;
    const isActive = daysBetween(latest.bookingDate, today.iso) <= recurring.activeWithinDays;
    if (isMonthly && isActive) payments.push({ latest, months });
  }
  return payments.sort((a, b) => b.latest.amount - a.latest.amount).slice(0, listLimits.recurring);
}

function describeNotableTransactions(transactions: readonly BankTransaction[], today: CalendarDay, format: Formatter): string {
  const notable = notableTransactions(transactions, today);
  if (notable.length === 0) return `Notable transactions: none in the last ${recentDays} days`;
  const lines = notable.map((t) => {
    const merchant = sanitizeForPrompt(t.merchant, textLimits.name);
    const sign = t.direction === 'expense' ? MINUS_SIGN : '+';
    const pending = t.status === 'pending' ? ' (pending)' : '';
    return `- ${t.bookingDate} · ${merchant} · ${t.category} · ${sign}${format.money(t.amount, t.currency)}${pending}${describeNote(t)}`;
  });
  return [`Notable transactions (last ${recentDays} days: the latest, plus the largest expenses):`, ...lines].join('\n');
}

/** The latest transactions and the largest recent expenses, newest first. */
function notableTransactions(transactions: readonly BankTransaction[], today: CalendarDay): BankTransaction[] {
  const recent = transactions.filter((t) => daysBetween(t.bookingDate, today.iso) <= recentDays);
  const newestFirst = [...recent].sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  const largestExpenses = recent.filter(isExpense).sort((a, b) => b.amount - a.amount).slice(0, listLimits.largestExpenses);
  const picked = new Map<string, BankTransaction>();
  for (const transaction of [...newestFirst.slice(0, listLimits.latest), ...largestExpenses]) picked.set(transaction.id, transaction);
  return [...picked.values()].sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
}

/** The bank's free-text description, when it says more than the merchant name. */
function describeNote(transaction: BankTransaction): string {
  const note = sanitizeForPrompt(transaction.description, textLimits.note);
  const merchant = transaction.merchant.trim().toLowerCase();
  if (!note || note.toLowerCase() === merchant) return '';
  return ` · note: "${note.replace(/"/g, "'")}"`;
}

function describeLoans(loans: readonly BankLoan[], format: Formatter): string {
  if (loans.length === 0) return 'Loans: none reported by the bank';
  const notReported = 'not reported';
  const lines = loans.slice(0, listLimits.loans).map((loan) => {
    const monthly = loan.monthlyPayment === null ? notReported : format.money(loan.monthlyPayment, loan.currency);
    const rate = loan.annualRatePercent === null ? notReported : `${format.percent(loan.annualRatePercent)} a year`;
    const monthsLeft = loan.remainingMonths === null ? notReported : String(loan.remainingMonths);
    return [
      `- ${sanitizeForPrompt(loan.name, textLimits.name)}: outstanding ${format.money(loan.outstanding, loan.currency)}`,
      `monthly payment ${monthly}`,
      `rate ${rate}`,
      `months left ${monthsLeft}`,
      `next payment ${loan.nextPaymentDate ?? notReported}`,
    ].join(', ');
  });
  return ['Loans:', ...lines, ...notShown(loans.length, listLimits.loans)].join('\n');
}

// MARK: App figures

function describePlan(summary: CoachFinanceSummary | null, format: Formatter): string {
  if (!summary) return "## App plan\nThe app hasn't computed a plan yet.";
  const categories = summary.topCategories.slice(0, listLimits.topCategories).map(({ category, spent, budget }) => {
    const budgetText = budget === null ? 'no budget set' : `budget ${format.money(budget)}`;
    return `- ${category}: spent ${format.money(spent)}, ${budgetText}`;
  });
  return [
    `## App plan (computed by the app in ${format.displayCurrency}; the screens show these figures)`,
    `Monthly income: ${format.money(summary.monthlyIncome)}`,
    `Monthly spending: ${format.money(summary.monthlySpending)}`,
    `Monthly plan: ${format.money(summary.monthlyPlan)}`,
    `Remaining this month: ${format.money(summary.remainingThisMonth)}`,
    `Today you can spend about (safe to spend today): ${format.money(summary.safeToSpendToday)}`,
    ...(categories.length > 0 ? ['Top categories:', ...categories] : []),
  ].join('\n');
}

function describeGoals(goals: readonly CoachGoal[], today: CalendarDay, format: Formatter): string {
  if (goals.length === 0) return '## Goals\nNo savings goals yet.';
  const lines = goals.slice(0, listLimits.goals).map((goal) => describeGoal(goal, today, format));
  return ['## Goals', ...lines, ...notShown(goals.length, listLimits.goals)].join('\n');
}

function describeGoal(goal: CoachGoal, today: CalendarDay, format: Formatter): string {
  const remaining = Math.max(goal.target - goal.saved, 0);
  const progress = goal.target > 0 ? Math.round(Math.min(goal.saved / goal.target, 1) * 100) : 100;
  const name = sanitizeForPrompt(goal.name, textLimits.name);
  return [
    `- ${name} (priority ${goal.priority}): ${format.money(goal.saved)} of ${format.money(goal.target)} saved (${progress}%), ${format.money(remaining)} to go`,
    `contributing ${format.money(goal.monthlyContribution)} a month`,
    describeGoalTiming(goal, remaining, today, format),
  ].join('; ');
}

function describeGoalTiming(goal: CoachGoal, remaining: number, today: CalendarDay, format: Formatter): string {
  if (remaining === 0) return `target date ${goal.targetDate}; reached`;
  if (goal.targetDate < today.iso) return `target date ${goal.targetDate}, already passed`;
  const months = wholeMonthsBetween(today.iso, goal.targetDate);
  const needed = remaining / Math.max(months, 1);
  return `target date ${goal.targetDate} (${months} months away); about ${format.money(needed)} a month needed to reach it on time`;
}

// MARK: Helpers

function isExpense(transaction: BankTransaction): boolean {
  return transaction.direction === 'expense';
}

/** Sums amounts per currency, e.g. "4,240.50 ₾ + $120.00"; zero in the display currency when empty. */
function totalsByCurrency<T extends { currency: CurrencyCode }>(items: readonly T[], amountOf: (item: T) => number, format: Formatter): string {
  const totals = new Map<CurrencyCode, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + amountOf(item));
  if (totals.size === 0) return format.money(0);
  return [...totals].map(([currency, total]) => format.money(total, currency)).join(' + ');
}

function notShown(total: number, shown: number): string[] {
  return total > shown ? [`(+${total - shown} more not shown)`] : [];
}
