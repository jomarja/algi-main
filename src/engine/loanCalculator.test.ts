import { describe, expect, it } from 'vitest';
import { currentLoanTerms } from './bankMapping.ts';
import { sampleConverter } from './currencyConverter.ts';
import { lt } from './localization.ts';
import { LoanCalculator, loanTerms, remainingMonths, safePercent, type LoanTerms } from './loan.ts';
import { compare, gel, MAXIMUM_PARSABLE_AMOUNT, zero } from './money.ts';
import { refinanceOffer } from './sampleData.ts';
import { ORIGINAL_LOAN, SAMPLE_BANK_LOAN, sampleTransactions } from './testFixtures.ts';

function terms({ principal = 1200, rate = 12, months = 12, upfront = 0, monthlyFee = 0, insurance = 0, penalty = 0 } = {}): LoanTerms {
  return loanTerms({
    name: lt('Loan', 'სესხი'),
    principal: gel(principal),
    annualRatePercent: rate,
    months,
    upfrontFeePercent: upfront,
    monthlyFee: gel(monthlyFee),
    monthlyInsurance: gel(insurance),
    earlyRepaymentPenaltyPercent: penalty,
  });
}

function currentLoan(): LoanTerms {
  const loan = currentLoanTerms([SAMPLE_BANK_LOAN], sampleConverter);
  if (!loan) throw new Error('The sample loan should map to loan terms');
  return loan;
}

describe('LoanCalculator', () => {
  it('computes the annuity installment', () => {
    expect(LoanCalculator.installment(gel(8000), 20, 48)).toEqual(gel(243.44));
  });

  it('splits a zero-rate loan evenly', () => {
    expect(LoanCalculator.installment(gel(1200), 0, 12)).toEqual(gel(100));
  });

  it('rejects incomplete terms', () => {
    expect(LoanCalculator.installment(gel(1200), 10, 0)).toBeNull();
    expect(LoanCalculator.cost(terms({ principal: 0 }))).toBeNull();
  });

  it('finds the remaining balance', () => {
    expect(LoanCalculator.remainingPrincipal(ORIGINAL_LOAN, 23)).toEqual(gel(4944.2));
    expect(LoanCalculator.remainingPrincipal(ORIGINAL_LOAN, 48)).toEqual(zero('GEL'));
  });

  it('the bank loan payment matches the calculator', () => {
    const payment = sampleTransactions().find((transaction) => transaction.category === 'debt');
    expect(payment?.amount).toEqual(LoanCalculator.installment(gel(8000), 20, 48));
  });

  it('maps the bank loan to the current loan terms', () => {
    const loan = currentLoan();
    expect(loan.principal).toEqual(gel(4944.2));
    expect(loan.months).toBe(25);
    expect(loan.annualRatePercent).toBe(20);
    expect(loan.earlyRepaymentPenaltyPercent).toBe(1);
  });

  it('costs the remaining current loan', () => {
    const cost = LoanCalculator.cost(currentLoan());
    expect(cost?.monthlyPayment).toEqual(gel(243.44));
    expect(cost?.totalInterest).toEqual(gel(1141.8));
    expect(cost?.totalFees).toEqual(zero('GEL'));
    expect(cost?.totalRepayable).toEqual(gel(6086));
  });

  it('includes fees and insurance in the offer', () => {
    const cost = LoanCalculator.cost(refinanceOffer(currentLoan().principal));
    expect(cost?.installment).toEqual(gel(120.23));
    expect(cost?.monthlyPayment).toEqual(gel(127.23));
    expect(cost?.totalInterest).toEqual(gel(2269.6));
    expect(cost?.totalFees).toEqual(gel(543.61));
    expect(cost?.totalRepayable).toEqual(gel(7757.41));
  });

  it('a lower rate can still cost more', () => {
    const loan = currentLoan();
    const comparison = LoanCalculator.compare(loan, refinanceOffer(loan.principal));
    expect(comparison.verdict).toBe('lowerPaymentLongerCommitment');
    expect(comparison.switchingCost).toEqual(gel(49.44));
    expect(comparison.totalDifference).toEqual(gel(1720.85));
    expect(comparison.monthlyDifference).toEqual(gel(-116.21));
    expect(comparison.extraMonths).toBe(35);
  });

  it('recognizes a cheaper offer', () => {
    expect(LoanCalculator.compare(terms({ rate: 20 }), terms({ rate: 10 })).verdict).toBe('potentiallyBeneficial');
  });

  it('flags an offer that costs more without lowering the payment', () => {
    expect(LoanCalculator.compare(terms({ rate: 12 }), terms({ rate: 12, monthlyFee: 10 })).verdict).toBe('moreExpensiveOverall');
  });

  it('treats tiny differences as the same', () => {
    expect(LoanCalculator.compare(terms({ rate: 12 }), terms({ rate: 12, monthlyFee: 1 })).verdict).toBe('similarCost');
  });

  it('counts the switching penalty', () => {
    const comparison = LoanCalculator.compare(terms({ rate: 12, penalty: 10 }), terms({ rate: 11 }));
    expect(comparison.switchingCost).toEqual(gel(120));
    expect(comparison.verdict).toBe('moreExpensiveOverall');
  });

  it('needs complete information to compare', () => {
    const comparison = LoanCalculator.compare(terms(), terms({ months: 0 }));
    expect(comparison.verdict).toBe('insufficientInformation');
    expect(comparison.totalDifference).toBeNull();
  });

  it('keeps typed percentages between zero and a hundred', () => {
    expect(safePercent(16)).toBe(16);
    expect(safePercent(-5)).toBe(0);
    expect(safePercent(1e30)).toBe(100);
    expect(safePercent(Number.NaN)).toBe(0);
  });

  it('handles the largest allowed loan without overflowing', () => {
    const largest = terms({ principal: MAXIMUM_PARSABLE_AMOUNT, rate: 100, months: 360, upfront: 100 });
    const cost = LoanCalculator.cost(largest);
    expect(cost).not.toBeNull();
    if (cost) expect(compare(cost.totalRepayable, largest.principal)).toBeGreaterThan(0);
  });

  it('simulates paying extra each month', () => {
    const base = LoanCalculator.payoff(currentLoan(), zero('GEL'));
    const faster = LoanCalculator.payoff(currentLoan(), gel(100));
    expect(base?.months).toBe(25);
    expect(faster?.months).toBe(17);
    expect(faster?.interest).toEqual(gel(756.86));
    if (base && faster) expect(compare(faster.interest, base.interest)).toBeLessThan(0);
  });

  it('solves the remaining term from the balance, rate and payment', () => {
    expect(remainingMonths(4944.2, 20, 243.44)).toBe(25);
    expect(remainingMonths(1200, 0, 100)).toBe(12);
    expect(remainingMonths(1000, 120, 5)).toBeNull();
  });
});
