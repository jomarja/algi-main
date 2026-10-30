import { describe, expect, it } from 'vitest';
import type { BankLoan } from '../../shared/bank.ts';
import {
  completeMonths,
  currentLoanTerms,
  deriveBankData,
  deriveMonthlyIncome,
  deriveNextPayday,
  deriveSpendingHistory,
  deriveTypicalMonthlySpending,
  deriveUpcomingPayments,
  mapAccounts,
  mapTransactions,
  mergeTransactions,
} from './bankMapping.ts';
import { tbilisiDate } from './calendar.ts';
import { sampleConverter as converter } from './currencyConverter.ts';
import { lt } from './localization.ts';
import { eur, gel, usd } from './money.ts';
import {
  bankTransaction,
  FIXTURE_NOW as now,
  FREELANCE_PAYMENT,
  octoberOnlySnapshot,
  SAMPLE_BANK_LOAN,
  sampleSnapshot,
  sampleTransactions,
} from './testFixtures.ts';
import { manualTransaction } from './transactions.ts';

const transactions = sampleTransactions();
const octoberOnly = mapTransactions(octoberOnlySnapshot());

describe('Mapping TBC data', () => {
  it('maps accounts with their balances in their own currency', () => {
    const accounts = mapAccounts(sampleSnapshot().accounts);
    expect(accounts.map((account) => account.balance)).toEqual([gel(2486.4), gel(14850)]);
    expect(accounts[0]).toMatchObject({ id: 'acc-everyday', name: lt('Everyday', 'Everyday'), kind: 'current' });
  });

  it('places each booking at the start of its day in Tbilisi and keeps the bank order', () => {
    expect(transactions).toHaveLength(79);
    expect(transactions[0]).toMatchObject({
      merchant: 'Coffee Lab',
      category: 'foodAndDrink',
      amount: gel(9.5),
      direction: 'expense',
      date: tbilisiDate(2026, 10, 29, 0, 0),
      source: { kind: 'bank', accountId: 'acc-everyday', accountName: lt('Everyday', 'Everyday') },
      isPending: false,
    });
    expect(transactions.find((transaction) => transaction.merchant === 'Spotify')?.amount).toEqual(eur(5.99));
  });

  it('marks pending items and skips bookings without a valid date', () => {
    const snapshot = sampleSnapshot({
      transactions: [
        { ...FREELANCE_PAYMENT, status: 'pending' },
        { ...FREELANCE_PAYMENT, id: 'broken', bookingDate: '29/10/2026' },
      ],
    });
    const mapped = mapTransactions(snapshot);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].isPending).toBe(true);
  });

  it('merges manual entries and applies category corrections by id', () => {
    const cash = manualTransaction(
      { merchant: 'Bazaar', category: 'groceries', amount: gel(20), direction: 'expense', date: now },
      'manual-1',
    );
    const zara = transactions.find((transaction) => transaction.merchant === 'Zara');
    const merged = mergeTransactions(transactions, [cash], { [zara?.id ?? '']: 'health', 'manual-1': 'foodAndDrink' });
    expect(merged).toHaveLength(80);
    expect(merged.find((transaction) => transaction.id === zara?.id)?.category).toBe('health');
    expect(merged.find((transaction) => transaction.id === 'manual-1')?.category).toBe('foodAndDrink');
    expect(merged[0]).toBe(transactions[0]);
  });
});

describe('Current loan terms', () => {
  const loan = (overrides: Partial<BankLoan>): BankLoan => ({ ...SAMPLE_BANK_LOAN, ...overrides });

  it('solves the remaining term when TBC omits it', () => {
    expect(currentLoanTerms([loan({ remainingMonths: null })], converter)?.months).toBe(25);
  });

  it('cannot cost a loan without its rate or term', () => {
    expect(currentLoanTerms([loan({ annualRatePercent: null })], converter)).toBeNull();
    expect(currentLoanTerms([loan({ remainingMonths: null, monthlyPayment: null })], converter)).toBeNull();
    expect(currentLoanTerms([], converter)).toBeNull();
  });

  it('picks the largest balance and plans in lari', () => {
    const small = loan({ id: 'small', outstanding: 900 });
    const dollars = loan({ id: 'usd', currency: 'USD', outstanding: 1000, monthlyPayment: 50 });
    const terms = currentLoanTerms([small, dollars], converter);
    expect(terms?.principal).toEqual(gel(2700));
    expect(currentLoanTerms([small, SAMPLE_BANK_LOAN], converter)?.principal).toEqual(gel(4944.2));
  });
});

describe('Monthly income and payday', () => {
  it('uses the recurring salary', () => {
    expect(deriveMonthlyIncome(transactions, now, converter)).toEqual(gel(3400));
  });

  it('ignores one-off income such as a freelance payment', () => {
    const withFreelance = mapTransactions(sampleSnapshot({ transactions: [FREELANCE_PAYMENT, ...sampleSnapshot().transactions] }));
    expect(deriveMonthlyIncome(withFreelance, now, converter)).toEqual(gel(3400));
  });

  it('falls back to the largest recent income with only one month of data', () => {
    expect(deriveMonthlyIncome(octoberOnly, now, converter)).toEqual(gel(3400));
    expect(deriveMonthlyIncome([], now, converter)).toEqual(gel(0));
  });

  it('projects the next payday a month after the last salary', () => {
    expect(deriveNextPayday(transactions, now, converter)).toEqual(tbilisiDate(2026, 11, 28, 0, 0));
    expect(deriveNextPayday(octoberOnly, now, converter)).toEqual(tbilisiDate(2026, 11, 28, 0, 0));
    expect(deriveNextPayday([], now, converter)).toBeNull();
  });

  it('never treats today as the next payday', () => {
    const paydayMorning = tbilisiDate(2026, 11, 28, 8, 0);
    expect(deriveNextPayday(transactions, paydayMorning, converter)).toEqual(tbilisiDate(2026, 12, 28, 0, 0));
  });
});

describe('Upcoming payments', () => {
  const nextPayday = tbilisiDate(2026, 11, 28, 0, 0);
  const upcoming = deriveUpcomingPayments(transactions, [SAMPLE_BANK_LOAN], now, nextPayday);

  it('lists the bills before payday, soonest first, like the iOS sample', () => {
    expect(upcoming.map((payment) => payment.id)).toEqual(['rent', 'loan-consumer-loan', 'telasi', 'icloud', 'magti', 'netflix', 'spotify']);
    expect(upcoming.map((payment) => payment.amount)).toEqual([
      gel(850),
      gel(243.44),
      gel(64.3),
      usd(0.99),
      gel(25),
      usd(9.99),
      eur(5.99),
    ]);
    expect(upcoming[0]).toEqual({
      id: 'rent',
      title: lt('Rent', 'ქირა'),
      category: 'housing',
      amount: gel(850),
      dueDate: tbilisiDate(2026, 11, 1, 0, 0),
      isEstimate: false,
    });
  });

  it('takes the loan payment from TBC and the bill dates from the payment history', () => {
    expect(upcoming[1]).toMatchObject({ title: lt('Loan payment', 'სესხის გადასახადი'), dueDate: tbilisiDate(2026, 11, 5, 0, 0) });
    expect(upcoming.find((payment) => payment.id === 'spotify')?.dueDate).toEqual(tbilisiDate(2026, 11, 23, 0, 0));
  });

  it('marks bills whose amount changes as estimates', () => {
    expect(upcoming.filter((payment) => payment.isEstimate).map((payment) => payment.id)).toEqual(['telasi']);
  });

  it('detects loan payments from transactions when TBC gives no schedule', () => {
    const withoutSchedule = deriveUpcomingPayments(transactions, [{ ...SAMPLE_BANK_LOAN, nextPaymentDate: null }], now, nextPayday);
    expect(withoutSchedule.find((payment) => payment.category === 'debt')).toMatchObject({
      id: 'loan-payment',
      amount: gel(243.44),
      dueDate: tbilisiDate(2026, 11, 5, 0, 0),
    });
  });

  it('rolls a stale loan date forward by whole months', () => {
    const stale = deriveUpcomingPayments(transactions, [{ ...SAMPLE_BANK_LOAN, nextPaymentDate: '2026-10-05' }], now, nextPayday);
    expect(stale.find((payment) => payment.category === 'debt')?.dueDate).toEqual(tbilisiDate(2026, 11, 5, 0, 0));
  });

  it('only lists payments due before the next payday', () => {
    const early = deriveUpcomingPayments(transactions, [SAMPLE_BANK_LOAN], now, tbilisiDate(2026, 11, 16, 0, 0));
    expect(early.map((payment) => payment.id)).toEqual(['rent', 'loan-consumer-loan', 'telasi', 'icloud']);
  });

  it('trusts a single recent bill, and treats a utility seen once as an estimate', () => {
    const fromOneMonth = deriveUpcomingPayments(octoberOnly, [SAMPLE_BANK_LOAN], now, nextPayday);
    expect(fromOneMonth).toHaveLength(7);
    expect(fromOneMonth.filter((payment) => payment.isEstimate).map((payment) => payment.id)).toEqual(['telasi', 'magti']);
  });

  it('drops subscriptions that stopped', () => {
    const cancelled = mapTransactions(
      sampleSnapshot({ transactions: [bankTransaction(['2026-08-10', 'HBO Max', 'subscriptions', 19.99], 'tx-hbo')] }),
    );
    expect(deriveUpcomingPayments(cancelled, [], now, nextPayday)).toEqual([]);
  });
});

describe('Spending history', () => {
  const history = deriveSpendingHistory(transactions, now, converter);

  it('covers the complete months before this one', () => {
    expect(history.completeMonths).toEqual([tbilisiDate(2026, 8, 1, 0, 0), tbilisiDate(2026, 9, 1, 0, 0)]);
  });

  it('reproduces the figures iOS hard-coded', () => {
    expect(history.previousMonthSpending).toEqual(gel(2240));
    expect(history.deliveryByMonth).toEqual([
      { month: tbilisiDate(2026, 8, 1, 0, 0), total: gel(118) },
      { month: tbilisiDate(2026, 9, 1, 0, 0), total: gel(142) },
    ]);
    expect(history.typicalShoppingPurchase).toEqual(gel(55));
    expect(history.savingStreakMonths).toBe(3);
  });

  it('averages food per calendar weekday and weekend day', () => {
    // 395 ₾ over 43 weekdays and 205 ₾ over 18 weekend days in August and September.
    expect(history.weekdayFoodDailyAverage).toEqual(gel(9.19));
    expect(history.weekendFoodDailyAverage).toEqual(gel(11.39));
  });

  it('finds the best saving month', () => {
    expect(history.bestSavingMonth).toEqual({ month: tbilisiDate(2026, 8, 1, 0, 0), total: gel(1468.86) });
  });

  it('knows when the data does not reach last month', () => {
    const firstMonth = deriveSpendingHistory(octoberOnly, now, converter);
    expect(firstMonth.completeMonths).toEqual([]);
    expect(firstMonth.previousMonthSpending).toBeNull();
    expect(firstMonth.deliveryByMonth).toEqual([]);
    expect(firstMonth.bestSavingMonth).toBeNull();
    expect(firstMonth.savingStreakMonths).toBe(1);
    expect(firstMonth.typicalShoppingPurchase).toEqual(gel(159.9));
  });

  it('counts a month only when the data starts in its first week', () => {
    const fromTheTwentieth = mapTransactions(
      sampleSnapshot({ transactions: sampleSnapshot().transactions.filter((transaction) => transaction.bookingDate >= '2026-08-20') }),
    );
    expect(completeMonths(fromTheTwentieth, now)).toEqual([tbilisiDate(2026, 9, 1, 0, 0)]);
  });

  it('does not let backdated manual entries extend the history', () => {
    const backdated = manualTransaction({
      merchant: 'Old purchase',
      category: 'shopping',
      amount: gel(10),
      direction: 'expense',
      date: tbilisiDate(2025, 1, 1),
    });
    expect(completeMonths([...octoberOnly, backdated], now)).toEqual([]);
    expect(completeMonths([backdated], now)).toHaveLength(21);
  });
});

describe('Typical month', () => {
  it('averages the complete months into the iOS budget lines', () => {
    expect(deriveTypicalMonthlySpending(transactions, now, converter)).toEqual([
      { category: 'foodDelivery', monthlyAmount: gel(130) },
      { category: 'foodAndDrink', monthlyAmount: gel(170) },
      { category: 'groceries', monthlyAmount: gel(320) },
      { category: 'transport', monthlyAmount: gel(90) },
      { category: 'subscriptions', monthlyAmount: gel(47.13) },
      { category: 'shopping', monthlyAmount: gel(120) },
      { category: 'utilities', monthlyAmount: gel(90) },
      { category: 'health', monthlyAmount: gel(25) },
      { category: 'housing', monthlyAmount: gel(850) },
      { category: 'debt', monthlyAmount: gel(243.44) },
    ]);
  });

  it('uses the last 30 days before a month is complete', () => {
    const lines = deriveTypicalMonthlySpending(octoberOnly, now, converter);
    expect(lines.find((line) => line.category === 'foodDelivery')?.monthlyAmount).toEqual(gel(185));
    expect(lines.find((line) => line.category === 'housing')?.monthlyAmount).toEqual(gel(850));
  });
});

describe('All bank-derived data', () => {
  it('derives everything in one pass', () => {
    const data = deriveBankData(transactions, [SAMPLE_BANK_LOAN], now, converter);
    expect(data.monthlyIncome).toEqual(gel(3400));
    expect(data.nextPayday).toEqual(tbilisiDate(2026, 11, 28, 0, 0));
    expect(data.upcomingPayments).toHaveLength(7);
    expect(data.history.previousMonthSpending).toEqual(gel(2240));
    expect(data.typicalMonthlySpending).toHaveLength(10);
  });
});
