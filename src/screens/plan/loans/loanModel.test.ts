import { describe, expect, it } from 'vitest';
import { add, currentLoanTerms, gel, LoanCalculator, loanTerms, lt, refinanceOffer, sampleConverter } from '../../../engine/index.ts';
import { SAMPLE_BANK_LOAN, sampleSnapshot } from '../../../engine/testFixtures.ts';
import {
  blankCurrentLoan,
  blankOffer,
  formatFieldNumber,
  hasBankAnswered,
  offerTotalWithSwitching,
  parseFieldNumber,
  switchingBudgetEffect,
} from './loanModel.ts';

const bankLoan = currentLoanTerms([SAMPLE_BANK_LOAN], sampleConverter);
if (!bankLoan) throw new Error('The sample bank loan should have terms.');

describe('blank loans', () => {
  it('leave the amount to the user, so the comparison waits for it', () => {
    expect(blankCurrentLoan().principal).toEqual(gel(0));
    expect(blankOffer().principal).toEqual(gel(0));
    expect(LoanCalculator.compare(blankCurrentLoan(), blankOffer()).verdict).toBe('insufficientInformation');
  });

  it('assume the usual early repayment fee on the current loan', () => {
    expect(blankCurrentLoan().earlyRepaymentPenaltyPercent).toBe(1);
  });
});

describe('parseFieldNumber', () => {
  it('reads plain, comma-decimal and spaced numbers', () => {
    expect(parseFieldNumber('12.5')).toBe(12.5);
    expect(parseFieldNumber('12,5')).toBe(12.5);
    expect(parseFieldNumber('1 240')).toBe(1240);
  });

  it('treats an empty field as zero', () => {
    expect(parseFieldNumber('')).toBe(0);
    expect(parseFieldNumber('  ')).toBe(0);
  });

  it('rejects anything that is not a non-negative number', () => {
    expect(parseFieldNumber('abc')).toBeNull();
    expect(parseFieldNumber('-3')).toBeNull();
    expect(parseFieldNumber('1e400')).toBeNull();
  });
});

describe('formatFieldNumber', () => {
  it('keeps up to two decimals without grouping', () => {
    expect(formatFieldNumber(12)).toBe('12');
    expect(formatFieldNumber(4944.2)).toBe('4944.2');
    expect(formatFieldNumber(1 / 3)).toBe('0.33');
    expect(formatFieldNumber(12000)).toBe('12000');
  });

  it('round-trips through parsing', () => {
    expect(parseFieldNumber(formatFieldNumber(2.5))).toBe(2.5);
  });
});

describe('offerTotalWithSwitching', () => {
  it('adds the early repayment fee to what the offer costs', () => {
    const comparison = LoanCalculator.compare(bankLoan, refinanceOffer(bankLoan.principal));
    const offer = comparison.offer;
    expect(offer).not.toBeNull();
    if (offer) expect(offerTotalWithSwitching(comparison)).toEqual(add(offer.totalRepayable, comparison.switchingCost));
  });

  it('is null when the offer cannot be costed', () => {
    expect(offerTotalWithSwitching(LoanCalculator.compare(bankLoan, blankOffer()))).toBeNull();
  });
});

describe('switchingBudgetEffect', () => {
  it('shows what a lower, longer payment frees each month', () => {
    const comparison = LoanCalculator.compare(bankLoan, refinanceOffer(bankLoan.principal));
    const effect = switchingBudgetEffect(comparison);
    expect(effect?.extraMonths).toBe(35);
    expect(effect?.freedMonthly.minorUnits).toBeGreaterThan(0);
  });

  it('is null when switching does not stretch a lower payment', () => {
    const shorter = loanTerms({ name: lt('Shorter', 'მოკლე'), principal: bankLoan.principal, annualRatePercent: 10, months: 12 });
    expect(switchingBudgetEffect(LoanCalculator.compare(bankLoan, shorter))).toBeNull();
    expect(switchingBudgetEffect(LoanCalculator.compare(bankLoan, blankOffer()))).toBeNull();
  });
});

describe('hasBankAnswered', () => {
  const connected = { connected: true, source: 'mock', consent: null, lastSyncedAt: null } as const;

  it('waits for the first answer', () => {
    expect(hasBankAnswered({ status: null, snapshot: null, sync: 'idle' })).toBe(false);
    expect(hasBankAnswered({ status: null, snapshot: null, sync: 'loading' })).toBe(false);
    expect(hasBankAnswered({ status: connected, snapshot: null, sync: 'loading' })).toBe(false);
  });

  it('counts a status, data or a failure as an answer', () => {
    expect(hasBankAnswered({ status: connected, snapshot: null, sync: 'idle' })).toBe(true);
    expect(hasBankAnswered({ status: null, snapshot: null, sync: 'error' })).toBe(true);
    expect(hasBankAnswered({ status: connected, snapshot: sampleSnapshot(), sync: 'loading' })).toBe(true);
  });
});
