import { describe, expect, it } from 'vitest';
import { gel, tbilisiDate, usd } from '../../engine/index.ts';
import { FIXTURE_NOW } from '../../engine/testFixtures.ts';
import {
  draftTransaction,
  entryModeFromSearch,
  hasAmountProblem,
  initialDraft,
  isDraftComplete,
  transactionDate,
  withDirection,
  type TransactionDraft,
} from './transactionDraft.ts';

const filled: TransactionDraft = { ...initialDraft(FIXTURE_NOW), merchant: '  Nikora ', amountText: '45,90' };

describe('entryModeFromSearch', () => {
  it('opens the receipt variant only for ?mode=receipt', () => {
    expect(entryModeFromSearch(new URLSearchParams('mode=receipt'))).toBe('receipt');
    expect(entryModeFromSearch(new URLSearchParams('mode=other'))).toBe('manual');
    expect(entryModeFromSearch(new URLSearchParams())).toBe('manual');
  });
});

describe('initialDraft and withDirection', () => {
  it('starts as a lari grocery expense dated today', () => {
    expect(initialDraft(FIXTURE_NOW)).toEqual({
      direction: 'expense',
      merchant: '',
      amountText: '',
      currency: 'GEL',
      category: 'groceries',
      day: '2026-10-29',
    });
  });

  it('switches the category with the direction', () => {
    const income = withDirection(filled, 'income');
    expect(income.category).toBe('income');
    expect(withDirection(income, 'expense').category).toBe('groceries');
    expect(income.merchant).toBe(filled.merchant);
  });
});

describe('hasAmountProblem', () => {
  it('flags typed amounts that are not positive numbers, but not an empty field', () => {
    expect(hasAmountProblem({ ...filled, amountText: '' })).toBe(false);
    expect(hasAmountProblem({ ...filled, amountText: '12.50' })).toBe(false);
    expect(hasAmountProblem({ ...filled, amountText: '0' })).toBe(true);
    expect(hasAmountProblem({ ...filled, amountText: '1e400' })).toBe(true);
  });
});

describe('transactionDate', () => {
  it('uses the current moment for today', () => {
    expect(transactionDate('2026-10-29', FIXTURE_NOW)).toEqual(FIXTURE_NOW);
  });

  it('uses noon for an earlier day', () => {
    expect(transactionDate('2026-10-20', FIXTURE_NOW)).toEqual(tbilisiDate(2026, 10, 20));
  });

  it('rejects future and malformed days', () => {
    expect(transactionDate('2026-10-30', FIXTURE_NOW)).toBeNull();
    expect(transactionDate('2026-02-30', FIXTURE_NOW)).toBeNull();
    expect(transactionDate('', FIXTURE_NOW)).toBeNull();
  });
});

describe('isDraftComplete', () => {
  it('needs a merchant, a positive amount and a day up to today', () => {
    expect(isDraftComplete(filled, FIXTURE_NOW)).toBe(true);
    expect(isDraftComplete({ ...filled, merchant: ' ' }, FIXTURE_NOW)).toBe(false);
    expect(isDraftComplete({ ...filled, amountText: 'abc' }, FIXTURE_NOW)).toBe(false);
    expect(isDraftComplete({ ...filled, day: '2026-11-01' }, FIXTURE_NOW)).toBe(false);
  });
});

describe('draftTransaction', () => {
  it('builds a manual transaction with a trimmed merchant', () => {
    expect(draftTransaction(filled, 'manual', FIXTURE_NOW, 'tx')).toEqual({
      id: 'tx',
      merchant: 'Nikora',
      category: 'groceries',
      amount: gel(45.9),
      direction: 'expense',
      date: FIXTURE_NOW,
      source: { kind: 'manual' },
      hasReceipt: false,
      isPending: false,
    });
  });

  it('marks receipt imports', () => {
    const transaction = draftTransaction({ ...filled, currency: 'USD' }, 'receipt', FIXTURE_NOW, 'tx');
    expect(transaction?.source).toEqual({ kind: 'receipt' });
    expect(transaction?.hasReceipt).toBe(true);
    expect(transaction?.amount).toEqual(usd(45.9));
  });

  it('is null until the merchant, amount and date are valid', () => {
    expect(draftTransaction({ ...filled, merchant: '   ' }, 'manual', FIXTURE_NOW)).toBeNull();
    expect(draftTransaction({ ...filled, amountText: '' }, 'manual', FIXTURE_NOW)).toBeNull();
    expect(draftTransaction({ ...filled, day: '2027-01-01' }, 'manual', FIXTURE_NOW)).toBeNull();
  });
});
