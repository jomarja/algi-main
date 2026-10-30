import type { BankAccount, BankLoan, BankSnapshot, BankTransaction } from '../../shared/bank.ts';
import {
  addDays,
  addMonths,
  dateParts,
  daysBetween,
  intervalContains,
  isWeekend,
  monthInterval,
  monthsBetween,
  nextMonthlyDate,
  parseIsoDay,
  startOfDay,
  startOfMonth,
  type DateInterval,
} from './calendar.ts';
import { SPENDING_CATEGORIES, type SpendingCategoryId } from './categories.ts';
import type { CurrencyConverter } from './currencyConverter.ts';
import type { MonthlyTotal, SpendingHistory } from './history.ts';
import { lt, type LocalizedText } from './localization.ts';
import { loanTerms, remainingMonths, type LoanTerms } from './loan.ts';
import {
  compare,
  divide,
  fromMinorUnits,
  majorUnits,
  money,
  moneyEquals,
  subtract,
  sum,
  zero,
  type Money,
} from './money.ts';
import type { BudgetLine, UpcomingPayment } from './monthlyBudget.ts';
import { round } from './rounding.ts';
import { ASSUMED_EARLY_REPAYMENT_PENALTY_PERCENT } from './sampleData.ts';
import { isIncome, type Account, type FinanceTransaction } from './transactions.ts';

/*
 * Turns TBC Open Banking data into the engine's accounts, transactions and loan terms, and derives from
 * the transaction history everything the iOS prototype hard-coded in SampleData: monthly income,
 * upcoming payments, the history figures, and the typical month the budget is built on.
 */

// Mapping

export function mapAccounts(accounts: readonly BankAccount[]): Account[] {
  return accounts.map((account) => ({
    id: account.id,
    name: lt(account.name, account.name),
    kind: account.kind,
    balance: money(account.balance, account.currency),
  }));
}

/**
 * TBC reports booking dates without a time, so each transaction sits at 00:00 Tbilisi time on its day.
 * That keeps it inside its day's, week's and month's half-open interval; items keep the bank's order.
 */
export function mapTransactions(snapshot: BankSnapshot): FinanceTransaction[] {
  const accountNames = new Map(snapshot.accounts.map((account) => [account.id, account.name]));
  return snapshot.transactions.flatMap((transaction) => {
    const date = parseIsoDay(transaction.bookingDate);
    return date ? [mapTransaction(transaction, date, accountNames.get(transaction.accountId) ?? '')] : [];
  });
}

function mapTransaction(transaction: BankTransaction, date: Date, accountName: string): FinanceTransaction {
  return {
    id: transaction.id,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: money(transaction.amount, transaction.currency),
    direction: transaction.direction,
    date,
    source: { kind: 'bank', accountId: transaction.accountId, accountName: lt(accountName, accountName) },
    hasReceipt: false,
    isPending: transaction.status === 'pending',
  };
}

/** Bank and manual transactions together, with the user's category corrections applied by transaction id. */
export function mergeTransactions(
  bank: readonly FinanceTransaction[],
  manual: readonly FinanceTransaction[],
  categoryOverrides: Readonly<Record<string, SpendingCategoryId>>,
): FinanceTransaction[] {
  return [...bank, ...manual].map((transaction) => {
    const category = Object.hasOwn(categoryOverrides, transaction.id) ? categoryOverrides[transaction.id] : null;
    return category && category !== transaction.category ? { ...transaction, category } : transaction;
  });
}

/**
 * The loan the comparison and what-if tools work with: the largest outstanding balance. Plans are in
 * lari, so a foreign-currency loan is converted at the illustrative rate. When TBC omits the remaining
 * term it is solved from the balance, rate and monthly payment. TBC doesn't report early-repayment fees,
 * so the iOS sample's 1% is assumed. Null when no loan has enough data to cost.
 */
export function currentLoanTerms(loans: readonly BankLoan[], converter: CurrencyConverter): LoanTerms | null {
  const largest = loans
    .map((loan) => ({ loan, outstanding: converter.convert(money(loan.outstanding, loan.currency), 'GEL') }))
    .filter(({ outstanding }) => outstanding.minorUnits > 0)
    .reduce<{ loan: BankLoan; outstanding: Money } | null>(
      (best, candidate) => (best === null || compare(candidate.outstanding, best.outstanding) > 0 ? candidate : best),
      null,
    );
  if (!largest) return null;

  const { loan, outstanding } = largest;
  const rate = loan.annualRatePercent;
  if (rate === null) return null;
  const monthlyPayment = loan.monthlyPayment === null ? null : converter.convert(money(loan.monthlyPayment, loan.currency), 'GEL');
  const months =
    loan.remainingMonths ?? (monthlyPayment ? remainingMonths(majorUnits(outstanding), rate, majorUnits(monthlyPayment)) : null);
  if (!months || months <= 0) return null;

  return loanTerms({
    name: lt('Current loan', 'მიმდინარე სესხი'),
    principal: outstanding,
    annualRatePercent: rate,
    months,
    earlyRepaymentPenaltyPercent: ASSUMED_EARLY_REPAYMENT_PENALTY_PERCENT,
  });
}

// Recurring payments

/** Payments whose typical (median) gap is 25–35 days count as monthly. */
const MONTHLY_GAP_DAYS = { min: 25, max: 35 } as const;
/** A monthly series is still running while its latest payment is at most this many days old. */
const ACTIVE_SERIES_MAX_AGE_DAYS = 45;
/** One sighting of a bill this recent is enough: rent, loans, bills and subscriptions are monthly by nature. */
const SINGLE_BILL_MAX_AGE_DAYS = 35;
/** Without a recurring income yet, the largest income within this window stands in for the monthly one. */
const INCOME_FALLBACK_WINDOW_DAYS = 31;
const BILL_CATEGORIES: readonly SpendingCategoryId[] = ['housing', 'debt', 'utilities', 'subscriptions'];
const LOAN_PAYMENT_TITLE = lt('Loan payment', 'სესხის გადასახადი');

/** Payments to one merchant, oldest first. */
interface TransactionSeries {
  readonly occurrences: readonly FinanceTransaction[];
}

/**
 * Expected monthly income: the latest amount of every income that arrives roughly monthly (a salary)
 * and is still arriving. With less than two months of data nothing looks monthly yet, so the largest
 * income of the last month stands in, so one-off refunds and transfers don't inflate it.
 */
export function deriveMonthlyIncome(transactions: readonly FinanceTransaction[], now: Date, converter: CurrencyConverter): Money {
  const recurring = recurringIncome(transactions, now);
  if (recurring.length > 0) return sum(recurring.map((series) => converter.convert(latest(series).amount, 'GEL')), 'GEL');
  const fallback = largestRecentIncome(transactions, now, converter);
  return fallback ? converter.convert(fallback.amount, 'GEL') : zero('GEL');
}

/**
 * The next payday after today, a month after the last one. A salary due today that hasn't arrived yet
 * still leaves a month of bills ahead, so "today" never counts as the next payday.
 */
export function deriveNextPayday(transactions: readonly FinanceTransaction[], now: Date, converter: CurrencyConverter): Date | null {
  const recurring = recurringIncome(transactions, now);
  const fallback = largestRecentIncome(transactions, now, converter);
  const lastPaydays = recurring.length > 0 ? recurring.map((series) => latest(series).date) : fallback ? [fallback.date] : [];
  const tomorrow = addDays(now, 1);
  const upcoming = lastPaydays.map((payday) => nextMonthlyDate(payday, tomorrow).getTime());
  return upcoming.length > 0 ? new Date(Math.min(...upcoming)) : null;
}

/**
 * Bills expected before the next payday (or within a month when payday is unknown), soonest first.
 * - Loans that report their next payment date come straight from TBC; debt transactions are then skipped.
 * - Rent, loan payments, bills and subscriptions are recurring when payments to the same merchant come
 *   roughly monthly and are still coming, or, seen only once, when that payment is recent.
 * - The next due date is a whole month after the latest payment, on or after today.
 * - The amount is the latest one; it is an estimate when earlier amounts differed, or for a utility bill
 *   seen only once, since metered bills change month to month.
 */
export function deriveUpcomingPayments(
  transactions: readonly FinanceTransaction[],
  loans: readonly BankLoan[],
  now: Date,
  nextPayday: Date | null,
): UpcomingPayment[] {
  const loanPayments = loans
    .map((loan) => upcomingLoanPayment(loan, now))
    .filter((payment): payment is UpcomingPayment => payment !== null);
  const billCategories = loanPayments.length > 0 ? BILL_CATEGORIES.filter((category) => category !== 'debt') : BILL_CATEGORIES;
  const bills = seriesByMerchant(
    transactions.filter((transaction) => !isIncome(transaction) && billCategories.includes(transaction.category)),
  )
    .filter((series) => isRecurringBill(series, now))
    .map((series) => upcomingBill(series, now));
  const windowEnd = (nextPayday ?? addMonths(now, 1)).getTime();
  return withUniqueIds([...loanPayments, ...bills])
    .filter((payment) => payment.dueDate.getTime() < windowEnd)
    .sort((lhs, rhs) => lhs.dueDate.getTime() - rhs.dueDate.getTime());
}

function recurringIncome(transactions: readonly FinanceTransaction[], now: Date): TransactionSeries[] {
  return seriesByMerchant(transactions.filter(isIncome)).filter(
    (series) => hasMonthlyCadence(series) && ageInDays(series, now) <= ACTIVE_SERIES_MAX_AGE_DAYS,
  );
}

function largestRecentIncome(
  transactions: readonly FinanceTransaction[],
  now: Date,
  converter: CurrencyConverter,
): FinanceTransaction | null {
  return transactions
    .filter((transaction) => {
      const age = daysBetween(transaction.date, now);
      return isIncome(transaction) && age >= 0 && age <= INCOME_FALLBACK_WINDOW_DAYS;
    })
    .reduce<FinanceTransaction | null>(
      (best, transaction) =>
        best === null || compare(converter.convert(transaction.amount, 'GEL'), converter.convert(best.amount, 'GEL')) > 0
          ? transaction
          : best,
      null,
    );
}

function isRecurringBill(series: TransactionSeries, now: Date): boolean {
  const age = ageInDays(series, now);
  if (series.occurrences.length === 1) return age >= 0 && age <= SINGLE_BILL_MAX_AGE_DAYS;
  return hasMonthlyCadence(series) && age <= ACTIVE_SERIES_MAX_AGE_DAYS;
}

function upcomingBill(series: TransactionSeries, now: Date): UpcomingPayment {
  const last = latest(series);
  const amountsVary = series.occurrences.some((transaction) => !moneyEquals(transaction.amount, last.amount));
  const isUnseenUtility = last.category === 'utilities' && series.occurrences.length === 1;
  return {
    id: slug(last.merchant),
    title: billTitle(last),
    category: last.category,
    amount: last.amount,
    dueDate: nextMonthlyDate(last.date, now),
    isEstimate: amountsVary || isUnseenUtility,
  };
}

function upcomingLoanPayment(loan: BankLoan, now: Date): UpcomingPayment | null {
  if (loan.monthlyPayment === null || loan.nextPaymentDate === null) return null;
  const scheduled = parseIsoDay(loan.nextPaymentDate);
  if (!scheduled) return null;
  // A date TBC hasn't rolled forward yet moves on by whole months.
  const dueDate = scheduled.getTime() >= startOfDay(now).getTime() ? scheduled : nextMonthlyDate(scheduled, now);
  return {
    id: `loan-${loan.id}`,
    title: LOAN_PAYMENT_TITLE,
    category: 'debt',
    amount: money(loan.monthlyPayment, loan.currency),
    dueDate,
    isEstimate: false,
  };
}

/** Rent and loans get a familiar name whatever the payee is called; other bills keep the merchant's. */
function billTitle(transaction: FinanceTransaction): LocalizedText {
  if (transaction.category === 'housing') return lt('Rent', 'ქირა');
  if (transaction.category === 'debt') return LOAN_PAYMENT_TITLE;
  return lt(transaction.merchant, transaction.merchant);
}

function seriesByMerchant(transactions: readonly FinanceTransaction[]): TransactionSeries[] {
  const groups = new Map<string, FinanceTransaction[]>();
  for (const transaction of transactions) {
    const key = transaction.merchant.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const group = groups.get(key);
    if (group) group.push(transaction);
    else groups.set(key, [transaction]);
  }
  return [...groups.values()].map((occurrences) => ({
    occurrences: [...occurrences].sort((lhs, rhs) => lhs.date.getTime() - rhs.date.getTime()),
  }));
}

function latest(series: TransactionSeries): FinanceTransaction {
  return series.occurrences[series.occurrences.length - 1];
}

function ageInDays(series: TransactionSeries, now: Date): number {
  return daysBetween(latest(series).date, now);
}

function hasMonthlyCadence(series: TransactionSeries): boolean {
  const days = [...new Set(series.occurrences.map((transaction) => startOfDay(transaction.date).getTime()))];
  if (days.length < 2) return false;
  const gaps = days.slice(1).map((day, index) => daysBetween(new Date(days[index]), new Date(day)));
  const typicalGap = median(gaps);
  return typicalGap >= MONTHLY_GAP_DAYS.min && typicalGap <= MONTHLY_GAP_DAYS.max;
}

function withUniqueIds(payments: readonly UpcomingPayment[]): UpcomingPayment[] {
  const seen = new Map<string, number>();
  return payments.map((payment) => {
    const count = (seen.get(payment.id) ?? 0) + 1;
    seen.set(payment.id, count);
    return count === 1 ? payment : { ...payment, id: `${payment.id}-${count}` };
  });
}

function slug(text: string): string {
  const slugged = text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slugged || 'payment';
}

// History and the typical month

/** The first month of the data counts as complete when its earliest transaction falls in its first week. */
const COVERAGE_GRACE_DAYS = 7;
/** Food delivery history compares this many past months, like the iOS August/September figures. */
const DELIVERY_HISTORY_MONTHS = 2;
/** The typical month averages up to this many complete months (TBC shares about 90 days). */
const TYPICAL_MONTHS = 3;
/** Without a complete month yet, the last 30 days and today stand in for a typical month. */
const FALLBACK_WINDOW_DAYS = 30;

/**
 * Months before the current one that the bank data fully covers, oldest first. Coverage starts at the
 * earliest bank transaction (manual entries can be backdated, so they don't extend it).
 */
export function completeMonths(transactions: readonly FinanceTransaction[], now: Date): Date[] {
  const bankTransactions = transactions.filter((transaction) => transaction.source.kind === 'bank');
  const covering = bankTransactions.length > 0 ? bankTransactions : transactions;
  if (covering.length === 0) return [];
  const earliest = covering.reduce(
    (first, transaction) => (transaction.date.getTime() < first.getTime() ? transaction.date : first),
    covering[0].date,
  );
  const earliestMonth = startOfMonth(earliest);
  const firstComplete = dateParts(earliest).day <= COVERAGE_GRACE_DAYS ? earliestMonth : addMonths(earliestMonth, 1);
  return monthsBetween(firstComplete, now);
}

/**
 * - previousMonthSpending: everything spent last month, when the data covers it.
 * - deliveryByMonth: food delivery in each of the last two complete months.
 * - weekday/weekendFoodDailyAverage: delivery plus restaurants and cafés per calendar weekday or weekend
 *   day over the complete months (this month so far when there are none).
 * - typicalShoppingPurchase: the median shopping purchase over the last three complete months
 *   (all shopping when there are none).
 * - savingStreakMonths: consecutive months with income above spending, counting this month only once it
 *   is ahead, since a month in progress shouldn't break a streak.
 * - bestSavingMonth: the complete month with the largest income minus spending.
 */
export function deriveSpendingHistory(
  transactions: readonly FinanceTransaction[],
  now: Date,
  converter: CurrencyConverter,
): SpendingHistory {
  const ledger = new Ledger(transactions, converter);
  const months = completeMonths(transactions, now);
  const previousMonth = addMonths(startOfMonth(now), -1);
  const coversPreviousMonth = months.at(-1)?.getTime() === previousMonth.getTime();
  const foodPeriods = months.length > 0 ? months.map(monthInterval) : [monthToDate(now)];
  const food = foodDailyAverages(ledger, foodPeriods);

  return {
    completeMonths: months,
    previousMonthSpending: coversPreviousMonth ? ledger.spent(monthInterval(previousMonth)) : null,
    deliveryByMonth: months
      .slice(-DELIVERY_HISTORY_MONTHS)
      .map((month) => ({ month, total: ledger.spent(monthInterval(month), 'foodDelivery') })),
    weekdayFoodDailyAverage: food.weekday,
    weekendFoodDailyAverage: food.weekend,
    typicalShoppingPurchase: typicalShoppingPurchase(ledger, months.slice(-TYPICAL_MONTHS).map(monthInterval)),
    savingStreakMonths: savingStreak(ledger, months, now),
    bestSavingMonth: bestSavingMonth(ledger, months),
  };
}

/**
 * The typical month the budget is built on: per spending category, the average of up to the last three
 * complete months, or the last 30 days when no month is complete yet. Categories with no spending are left out.
 */
export function deriveTypicalMonthlySpending(
  transactions: readonly FinanceTransaction[],
  now: Date,
  converter: CurrencyConverter,
): BudgetLine[] {
  const ledger = new Ledger(transactions, converter);
  const months = completeMonths(transactions, now).slice(-TYPICAL_MONTHS);
  const today = startOfDay(now);
  const periods =
    months.length > 0 ? months.map(monthInterval) : [{ start: addDays(today, -FALLBACK_WINDOW_DAYS), end: addDays(today, 1) }];
  return SPENDING_CATEGORIES.filter((category) => category !== 'income').flatMap((category) => {
    const total = sum(periods.map((period) => ledger.spent(period, category)), 'GEL');
    const monthlyAmount = divide(total, periods.length);
    return monthlyAmount.minorUnits > 0 ? [{ category, monthlyAmount }] : [];
  });
}

export interface BankDerivedData {
  readonly monthlyIncome: Money;
  readonly nextPayday: Date | null;
  readonly upcomingPayments: readonly UpcomingPayment[];
  readonly history: SpendingHistory;
  readonly typicalMonthlySpending: readonly BudgetLine[];
}

/** Every figure the app derives from the transaction history, computed together. */
export function deriveBankData(
  transactions: readonly FinanceTransaction[],
  loans: readonly BankLoan[],
  now: Date,
  converter: CurrencyConverter,
): BankDerivedData {
  const nextPayday = deriveNextPayday(transactions, now, converter);
  return {
    monthlyIncome: deriveMonthlyIncome(transactions, now, converter),
    nextPayday,
    upcomingPayments: deriveUpcomingPayments(transactions, loans, now, nextPayday),
    history: deriveSpendingHistory(transactions, now, converter),
    typicalMonthlySpending: deriveTypicalMonthlySpending(transactions, now, converter),
  };
}

/** Lari totals over a set of transactions. */
class Ledger {
  readonly transactions: readonly FinanceTransaction[];
  readonly converter: CurrencyConverter;

  constructor(transactions: readonly FinanceTransaction[], converter: CurrencyConverter) {
    this.transactions = transactions;
    this.converter = converter;
  }

  expenses(interval: DateInterval, category: SpendingCategoryId | null = null): FinanceTransaction[] {
    return this.transactions.filter(
      (transaction) =>
        !isIncome(transaction) &&
        intervalContains(interval, transaction.date) &&
        (category === null || transaction.category === category),
    );
  }

  spent(interval: DateInterval, category: SpendingCategoryId | null = null): Money {
    return this.total(this.expenses(interval, category));
  }

  /** Income minus spending. */
  net(interval: DateInterval): Money {
    const earned = this.total(
      this.transactions.filter((transaction) => isIncome(transaction) && intervalContains(interval, transaction.date)),
    );
    return subtract(earned, this.spent(interval));
  }

  gel(transaction: FinanceTransaction): Money {
    return this.converter.convert(transaction.amount, 'GEL');
  }

  total(transactions: readonly FinanceTransaction[]): Money {
    return sum(transactions.map((transaction) => this.gel(transaction)), 'GEL');
  }
}

function monthToDate(now: Date): DateInterval {
  return { start: startOfMonth(now), end: addDays(startOfDay(now), 1) };
}

function foodDailyAverages(ledger: Ledger, periods: readonly DateInterval[]): { weekday: Money; weekend: Money } {
  let weekdays = 0;
  let weekendDays = 0;
  for (const period of periods) {
    for (let day = period.start; day.getTime() < period.end.getTime(); day = addDays(day, 1)) {
      if (isWeekend(day)) weekendDays += 1;
      else weekdays += 1;
    }
  }
  const food = periods.flatMap((period) =>
    ledger.expenses(period).filter((transaction) => transaction.category === 'foodDelivery' || transaction.category === 'foodAndDrink'),
  );
  const weekendTotal = ledger.total(food.filter((transaction) => isWeekend(transaction.date)));
  const weekdayTotal = ledger.total(food.filter((transaction) => !isWeekend(transaction.date)));
  return {
    weekday: weekdays > 0 ? divide(weekdayTotal, weekdays) : zero('GEL'),
    weekend: weekendDays > 0 ? divide(weekendTotal, weekendDays) : zero('GEL'),
  };
}

function typicalShoppingPurchase(ledger: Ledger, periods: readonly DateInterval[]): Money | null {
  const inPeriods = periods.flatMap((period) => ledger.expenses(period, 'shopping'));
  const purchases =
    inPeriods.length > 0
      ? inPeriods
      : ledger.transactions.filter((transaction) => !isIncome(transaction) && transaction.category === 'shopping');
  if (purchases.length === 0) return null;
  return fromMinorUnits(round(median(purchases.map((purchase) => ledger.gel(purchase).minorUnits))), 'GEL');
}

function savingStreak(ledger: Ledger, months: readonly Date[], now: Date): number {
  const isAhead = (interval: DateInterval) => ledger.net(interval).minorUnits > 0;
  let streak = isAhead(monthInterval(now)) ? 1 : 0;
  for (const month of [...months].reverse()) {
    if (!isAhead(monthInterval(month))) break;
    streak += 1;
  }
  return streak;
}

function bestSavingMonth(ledger: Ledger, months: readonly Date[]): MonthlyTotal | null {
  return months
    .map((month) => ({ month, total: ledger.net(monthInterval(month)) }))
    .filter(({ total }) => total.minorUnits > 0)
    .reduce<MonthlyTotal | null>((best, candidate) => (best === null || compare(candidate.total, best.total) > 0 ? candidate : best), null);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((lhs, rhs) => lhs - rhs);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
