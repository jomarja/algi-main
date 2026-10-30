import { describe, expect, it } from 'vitest';
import {
  createDisplay,
  gel,
  lt,
  manualTransaction,
  MINUS_SIGN,
  NON_BREAKING_SPACE as nbsp,
  sampleConverter,
  usd,
  type FinanceTransaction,
} from '../../engine/index.ts';
import { FIXTURE_NOW, sampleTransactions } from '../../engine/testFixtures.ts';
import { dayNetTotal, receiptLines, transactionRowContent, transactionSourceText } from './transactionPresentation.ts';

const english = createDisplay('en', 'GEL');
const georgian = createDisplay('ka', 'GEL');

function sample(merchant: string): FinanceTransaction {
  const transaction = sampleTransactions().find((candidate) => candidate.merchant === merchant);
  if (!transaction) throw new Error(`No sample transaction from ${merchant}`);
  return transaction;
}

describe('transactionRowContent', () => {
  it('shows the day, category and signed amount of a lari expense', () => {
    expect(transactionRowContent(sample('Coffee Lab'), english, FIXTURE_NOW)).toEqual({
      merchant: 'Coffee Lab',
      detail: 'Today · Food & drink',
      amount: `${MINUS_SIGN}9.50${nbsp}₾`,
      convertedAmount: undefined,
      isIncome: false,
      hasReceipt: false,
      category: { icon: 'fork.knife', tint: 'coral', background: 'coralPale' },
    });
  });

  it('keeps the original currency and adds the display-currency value', () => {
    const content = transactionRowContent(sample('Spotify'), english, FIXTURE_NOW);
    expect(content.amount).toBe(`${MINUS_SIGN}€5.99`);
    expect(content.convertedAmount).toBe(`${MINUS_SIGN}17.49${nbsp}₾`);
  });

  it('marks income with a plus sign', () => {
    const content = transactionRowContent(sample('Salary'), english, FIXTURE_NOW);
    expect(content.isIncome).toBe(true);
    expect(content.amount).toBe(`+3,400.00${nbsp}₾`);
    expect(content.detail).toBe('Yesterday · Income');
  });

  it('says when a bank transaction is still pending', () => {
    const pending = { ...sample('Bolt'), isPending: true };
    expect(transactionRowContent(pending, georgian, FIXTURE_NOW).detail).toBe('დღეს · ტრანსპორტი · მოლოდინში');
  });
});

describe('transactionSourceText', () => {
  it('names TBC Bank and the account for bank transactions', () => {
    expect(transactionSourceText(sample('Bolt').source, english)).toBe('TBC Bank · Everyday');
  });

  it('falls back to the bank name when the account has no name', () => {
    expect(transactionSourceText({ kind: 'bank', accountId: 'x', accountName: lt('', '') }, english)).toBe('TBC Bank');
  });

  it('says how manual entries were added', () => {
    expect(transactionSourceText({ kind: 'manual' }, english)).toBe('Added manually');
    expect(transactionSourceText({ kind: 'receipt' }, georgian)).toBe('იმპორტირებული ქვითრიდან');
  });
});

describe('dayNetTotal', () => {
  it('adds income and subtracts spending in lari, converting foreign amounts', () => {
    const coffee = manualTransaction(
      { merchant: 'Cafe', category: 'foodAndDrink', amount: gel(10), direction: 'expense', date: FIXTURE_NOW },
      'a',
    );
    const refund = manualTransaction(
      { merchant: 'Shop', category: 'income', amount: usd(10), direction: 'income', date: FIXTURE_NOW },
      'b',
    );
    expect(dayNetTotal([coffee, refund], sampleConverter)).toEqual(gel(17));
  });

  it('is zero for an empty day', () => {
    expect(dayNetTotal([], sampleConverter)).toEqual(gel(0));
  });
});

describe('receiptLines', () => {
  it('splits the total into three groups that add back up exactly', () => {
    const lines = receiptLines(gel(112.35));
    expect(lines).toEqual([gel(51.68), gel(34.83), gel(25.84)]);
    expect(lines.reduce((total, line) => total + line.minorUnits, 0)).toBe(11235);
  });
});
