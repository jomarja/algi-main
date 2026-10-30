import type { BankLoan, BankSnapshot, BankTransaction, CurrencyCode, SpendingCategoryId } from '../../shared/bank.ts';
import { deriveTypicalMonthlySpending, mapAccounts, mapTransactions } from './bankMapping.ts';
import { tbilisiDate } from './calendar.ts';
import { sampleConverter } from './currencyConverter.ts';
import { FinanceSummary } from './financeSummary.ts';
import { lt } from './localization.ts';
import { loanTerms, type LoanTerms } from './loan.ts';
import { gel, type Money } from './money.ts';
import { MonthlyBudget } from './monthlyBudget.ts';
import { defaultGoals } from './sampleData.ts';
import type { SavingsGoal } from './savingsGoal.ts';
import type { FinanceTransaction } from './transactions.ts';

/**
 * A TBC snapshot mirroring the iOS sample month (October 2026, viewed on the 29th at 09:00), plus August
 * and September history built so the derived figures equal what iOS hard-coded in SampleData:
 * income 3,400 ₾, typical month (rent 850, loan 243.44, groceries 320, bills 90, transport 90, health 25,
 * food & drink 170, delivery 130, shopping 120, subscriptions 47.13), last month's spending 2,240 ₾,
 * delivery 118 ₾ / 142 ₾, a typical 55 ₾ shopping purchase, and a 3-month saving streak.
 */
export const FIXTURE_NOW = tbilisiDate(2026, 10, 29, 9, 0);

type Row = readonly [day: string, merchant: string, category: SpendingCategoryId, amount: number, currency?: CurrencyCode];

/** Newest first, as TBC lists them, so Coffee Lab (08:45 in iOS) comes before Bolt (08:20) on the 29th. */
const OCTOBER: readonly Row[] = [
  ['2026-10-29', 'Coffee Lab', 'foodAndDrink', 9.5],
  ['2026-10-29', 'Bolt', 'transport', 7.4],
  ['2026-10-28', 'Wolt', 'foodDelivery', 34.8],
  ['2026-10-28', "McDonald's", 'foodAndDrink', 26.5],
  ['2026-10-28', 'Tbilisi Metro', 'transport', 1],
  ['2026-10-28', 'Salary', 'income', 3400],
  ['2026-10-26', 'Wolt', 'foodDelivery', 29.9],
  ['2026-10-26', 'Nikora', 'groceries', 48.2],
  ['2026-10-25', 'Glovo', 'foodDelivery', 41.6],
  ['2026-10-25', 'Carrefour', 'groceries', 112.35],
  ['2026-10-24', 'Khinkali House', 'foodAndDrink', 86],
  ['2026-10-23', 'Spotify', 'subscriptions', 5.99, 'EUR'],
  ['2026-10-22', 'Netflix', 'subscriptions', 9.99, 'USD'],
  ['2026-10-21', 'Magti', 'utilities', 25],
  ['2026-10-20', 'Wolt', 'foodDelivery', 38.4],
  ['2026-10-19', 'Wissol', 'transport', 80],
  ['2026-10-18', 'Zara', 'shopping', 159.9],
  ['2026-10-17', 'Entrée', 'foodAndDrink', 54],
  ['2026-10-15', 'Telasi', 'utilities', 64.3],
  ['2026-10-15', 'iCloud+', 'subscriptions', 0.99, 'USD'],
  ['2026-10-12', 'Wolt', 'foodDelivery', 40.3],
  ['2026-10-10', 'Aversi', 'health', 23.75],
  ['2026-10-08', 'Spar', 'groceries', 62.4],
  ['2026-10-05', 'Loan payment', 'debt', 243.44],
  ['2026-10-03', 'Nikora', 'groceries', 73.1],
  ['2026-10-01', 'Rent', 'housing', 850],
];

/** 2,240 ₾ spent; food: 272 ₾ on weekdays, 110 ₾ at weekends. */
const SEPTEMBER: readonly Row[] = [
  ['2026-09-28', 'Salary', 'income', 3400],
  ['2026-09-26', 'Nikora', 'groceries', 90],
  ['2026-09-25', 'Khinkali House', 'foodAndDrink', 70],
  ['2026-09-24', 'Wolt', 'foodDelivery', 34.5],
  ['2026-09-23', 'Spotify', 'subscriptions', 5.99, 'EUR'],
  ['2026-09-23', 'Biblusi', 'shopping', 10],
  ['2026-09-22', 'Netflix', 'subscriptions', 9.99, 'USD'],
  ['2026-09-22', 'Coffee Lab', 'foodAndDrink', 10],
  ['2026-09-21', 'Tbilisi Metro', 'transport', 8],
  ['2026-09-21', 'Magti', 'utilities', 25],
  ['2026-09-20', 'Mango', 'shopping', 55],
  ['2026-09-19', 'Wolt', 'foodDelivery', 38],
  ['2026-09-18', 'Spar', 'groceries', 64],
  ['2026-09-17', 'Entrée', 'foodAndDrink', 48],
  ['2026-09-16', 'Aversi', 'health', 28.53],
  ['2026-09-15', 'iCloud+', 'subscriptions', 0.99, 'USD'],
  ['2026-09-15', 'Telasi', 'utilities', 63.9],
  ['2026-09-14', 'Wissol', 'transport', 80],
  ['2026-09-13', 'Khinkali House', 'foodAndDrink', 72],
  ['2026-09-12', 'Carrefour', 'groceries', 140.6],
  ['2026-09-11', "McDonald's", 'foodAndDrink', 28],
  ['2026-09-10', 'Glovo', 'foodDelivery', 33],
  ['2026-09-09', 'Bolt', 'transport', 12],
  ['2026-09-08', 'Coffee Lab', 'foodAndDrink', 12],
  ['2026-09-06', 'Zara', 'shopping', 55],
  ['2026-09-05', 'Loan payment', 'debt', 243.44],
  ['2026-09-04', 'Wolt', 'foodDelivery', 36.5],
  ['2026-09-03', 'Nikora', 'groceries', 85.4],
  ['2026-09-01', 'Rent', 'housing', 850],
];

/** 1,931.14 ₾ spent; food: 123 ₾ on weekdays, 95 ₾ at weekends. */
const AUGUST: readonly Row[] = [
  ['2026-08-28', 'Salary', 'income', 3400],
  ['2026-08-27', 'Wolt', 'foodDelivery', 28],
  ['2026-08-26', 'Biblusi', 'shopping', 10],
  ['2026-08-25', 'Spar', 'groceries', 70],
  ['2026-08-23', 'Spotify', 'subscriptions', 5.99, 'EUR'],
  ['2026-08-23', 'Entrée', 'foodAndDrink', 66],
  ['2026-08-22', 'Netflix', 'subscriptions', 9.99, 'USD'],
  ['2026-08-21', 'Magti', 'utilities', 25],
  ['2026-08-21', 'Mango', 'shopping', 55],
  ['2026-08-20', 'Wolt', 'foodDelivery', 30],
  ['2026-08-19', 'Aversi', 'health', 21.47],
  ['2026-08-18', 'Wissol', 'transport', 70],
  ['2026-08-16', 'Carrefour', 'groceries', 120],
  ['2026-08-15', 'iCloud+', 'subscriptions', 0.99, 'USD'],
  ['2026-08-15', 'Telasi', 'utilities', 66.1],
  ['2026-08-15', 'Glovo', 'foodDelivery', 29],
  ['2026-08-14', "McDonald's", 'foodAndDrink', 25],
  ['2026-08-12', 'Bolt', 'transport', 10],
  ['2026-08-11', 'Coffee Lab', 'foodAndDrink', 9],
  ['2026-08-09', 'Zara', 'shopping', 55],
  ['2026-08-07', 'Wolt', 'foodDelivery', 31],
  ['2026-08-05', 'Loan payment', 'debt', 243.44],
  ['2026-08-04', 'Nikora', 'groceries', 70],
  ['2026-08-01', 'Rent', 'housing', 850],
];

const EVERYDAY_ACCOUNT_ID = 'acc-everyday';

export function bankTransaction(row: Row, id: string): BankTransaction {
  const [bookingDate, merchant, category, amount, currency = 'GEL'] = row;
  return {
    id,
    accountId: EVERYDAY_ACCOUNT_ID,
    bookingDate,
    amount,
    direction: category === 'income' ? 'income' : 'expense',
    currency,
    merchant,
    description: merchant,
    category,
    status: 'booked',
  };
}

/** The sample loan: 8,000 ₾ at 20% over 48 months, 23 payments made, 4,944.20 ₾ left over 25 months. */
export const SAMPLE_BANK_LOAN: BankLoan = {
  id: 'consumer-loan',
  name: 'Consumer loan',
  currency: 'GEL',
  outstanding: 4944.2,
  monthlyPayment: 243.44,
  annualRatePercent: 20,
  remainingMonths: 25,
  nextPaymentDate: '2026-11-05',
};

/** The loan as originally taken out; TBC doesn't report it, the rewards test needs it. */
export const ORIGINAL_LOAN: LoanTerms = loanTerms({
  name: lt('Consumer loan', 'სამომხმარებლო სესხი'),
  principal: gel(8000),
  annualRatePercent: 20,
  months: 48,
  upfrontFeePercent: 1,
  earlyRepaymentPenaltyPercent: 1,
});

/** A payment that arrives on the next sync, like the iOS "Freelance payment". */
export const FREELANCE_PAYMENT: BankTransaction = bankTransaction(['2026-10-29', 'Freelance payment', 'income', 250], 'tx-freelance');

export function sampleSnapshot(overrides: Partial<BankSnapshot> = {}): BankSnapshot {
  return {
    source: 'mock',
    bank: 'TBC Bank',
    consent: { id: 'consent-sample', status: 'valid', validUntil: '2027-01-27' },
    accounts: [
      {
        id: EVERYDAY_ACCOUNT_ID,
        iban: 'GE29TB7777777777777771',
        name: 'Everyday',
        kind: 'current',
        currency: 'GEL',
        balance: 2486.4,
        available: 2486.4,
      },
      {
        id: 'acc-savings',
        iban: 'GE29TB7777777777777772',
        name: 'Savings',
        kind: 'savings',
        currency: 'GEL',
        balance: 14850,
        available: null,
      },
    ],
    transactions: [...OCTOBER, ...SEPTEMBER, ...AUGUST].map((row, index) => bankTransaction(row, `tx-${index + 1}`)),
    loans: [SAMPLE_BANK_LOAN],
    fetchedAt: FIXTURE_NOW.toISOString(),
    ...overrides,
  };
}

/** The sample snapshot limited to October, like a first sync with only this month's data. */
export function octoberOnlySnapshot(): BankSnapshot {
  return sampleSnapshot({
    transactions: OCTOBER.map((row, index) => bankTransaction(row, `tx-${index + 1}`)),
  });
}

export function sampleTransactions(): FinanceTransaction[] {
  return mapTransactions(sampleSnapshot());
}

export function sampleGoals(): SavingsGoal[] {
  return defaultGoals(FIXTURE_NOW);
}

/** The iOS FinanceSummary setup: sample accounts and transactions with the 2,400 / 280 / 200 ₾ plans. */
export function sampleFinance(transactions: readonly FinanceTransaction[] = sampleTransactions()): FinanceSummary {
  return new FinanceSummary({
    accounts: mapAccounts(sampleSnapshot().accounts),
    transactions,
    monthlyPlan: gel(2400),
    weeklyPlan: gel(280),
    deliveryMonthlyBudget: gel(200),
    now: FIXTURE_NOW,
  });
}

/** The iOS MonthlyBudget setup: 3,400 ₾ income and the typical month derived from the history above. */
export function sampleBudget(savingsContributions: Money = gel(1000)): MonthlyBudget {
  return new MonthlyBudget({
    income: gel(3400),
    lines: deriveTypicalMonthlySpending(sampleTransactions(), FIXTURE_NOW, sampleConverter),
    savingsContributions,
  });
}
