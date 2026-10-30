import type { LocalizedText } from './localization.ts';
import { add, compare, money, multiply, negate, subtract, zero, type Money } from './money.ts';

/** Everything that determines what a loan really costs, not just its headline rate. */
export interface LoanTerms {
  readonly name: LocalizedText;
  /** Amount borrowed, or the balance being refinanced. */
  readonly principal: Money;
  /** Nominal annual interest rate, e.g. 16 for 16%. */
  readonly annualRatePercent: number;
  readonly months: number;
  readonly isVariableRate: boolean;
  /** One-off fee charged on the principal when the loan starts. */
  readonly upfrontFeePercent: number;
  readonly monthlyFee: Money;
  /** Compulsory insurance paid with each installment. */
  readonly monthlyInsurance: Money;
  /** Charged on the remaining principal if the loan is repaid early (e.g. to refinance). */
  readonly earlyRepaymentPenaltyPercent: number;
}

export type LoanTermsInput = Pick<LoanTerms, 'name' | 'principal' | 'annualRatePercent' | 'months'> &
  Partial<Omit<LoanTerms, 'name' | 'principal' | 'annualRatePercent' | 'months'>>;

/** Loan terms with no fees, insurance, or penalty unless given; fees default to the principal's currency. */
export function loanTerms(input: LoanTermsInput): LoanTerms {
  const currency = input.principal.currency;
  return {
    isVariableRate: false,
    upfrontFeePercent: 0,
    monthlyFee: zero(currency),
    monthlyInsurance: zero(currency),
    earlyRepaymentPenaltyPercent: 0,
    ...input,
  };
}

export function isLoanTermsComplete(terms: LoanTerms): boolean {
  return terms.principal.minorUnits > 0 && terms.months > 0 && terms.annualRatePercent >= 0;
}

/** Rates and fees are typed as percentages; anything outside 0–100% is treated as a typo. */
export function safePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

export interface LoanCost {
  /** Principal plus interest each month. */
  readonly installment: Money;
  /** What actually leaves the account each month: installment, fees, and insurance. */
  readonly monthlyPayment: Money;
  readonly totalInterest: Money;
  /** Upfront fee plus monthly fees and insurance over the whole term. */
  readonly totalFees: Money;
  readonly totalRepayable: Money;
  readonly months: number;
}

export type LoanVerdict =
  | 'potentiallyBeneficial'
  | 'similarCost'
  | 'moreExpensiveOverall'
  | 'lowerPaymentLongerCommitment'
  | 'insufficientInformation';

export interface LoanPayoff {
  readonly months: number;
  readonly interest: Money;
}

/** Differences smaller than this many major units are treated as "about the same". */
export const NEGLIGIBLE_LOAN_DIFFERENCE = 20;
/** A balance below this is treated as repaid, absorbing installment rounding. */
export const REPAID_THRESHOLD = 1.0;
const ROUNDING_TOLERANCE_MONTHS = 0.05;

export class LoanComparison {
  readonly current: LoanCost | null;
  readonly offer: LoanCost | null;
  /** Early repayment penalty on the current loan, paid when switching. */
  readonly switchingCost: Money;
  readonly verdict: LoanVerdict;

  constructor(current: LoanCost | null, offer: LoanCost | null, switchingCost: Money, verdict: LoanVerdict) {
    this.current = current;
    this.offer = offer;
    this.switchingCost = switchingCost;
    this.verdict = verdict;
  }

  /** Positive when the offer costs more overall, switching costs included. */
  get totalDifference(): Money | null {
    if (!this.current || !this.offer) return null;
    return subtract(add(this.offer.totalRepayable, this.switchingCost), this.current.totalRepayable);
  }

  /** Negative when the offer lowers the monthly payment. */
  get monthlyDifference(): Money | null {
    if (!this.current || !this.offer) return null;
    return subtract(this.offer.monthlyPayment, this.current.monthlyPayment);
  }

  get extraMonths(): number | null {
    if (!this.current || !this.offer) return null;
    return this.offer.months - this.current.months;
  }
}

function installment(principal: Money, annualRatePercent: number, months: number): Money | null {
  const payment = rawInstallment(principal.minorUnits / 100, annualRatePercent, months);
  if (payment === null || principal.minorUnits <= 0) return null;
  return money(payment, principal.currency);
}

function cost(terms: LoanTerms): LoanCost | null {
  if (!isLoanTermsComplete(terms)) return null;
  const monthlyInstallment = installment(terms.principal, terms.annualRatePercent, terms.months);
  if (!monthlyInstallment) return null;

  const totalInterest = subtract(multiply(monthlyInstallment, terms.months), terms.principal);
  const upfrontFee = multiply(terms.principal, terms.upfrontFeePercent / 100);
  const recurringFees = multiply(add(terms.monthlyFee, terms.monthlyInsurance), terms.months);
  const totalFees = add(upfrontFee, recurringFees);

  return {
    installment: monthlyInstallment,
    monthlyPayment: add(add(monthlyInstallment, terms.monthlyFee), terms.monthlyInsurance),
    totalInterest,
    totalFees,
    totalRepayable: add(add(terms.principal, totalInterest), totalFees),
    months: terms.months,
  };
}

/** Principal still owed after a number of regular installments. */
function remainingPrincipal(terms: LoanTerms, afterPayments: number): Money {
  const principal = terms.principal.minorUnits / 100;
  const payment = rawInstallment(principal, terms.annualRatePercent, terms.months);
  if (payment === null) return terms.principal;
  const rate = monthlyRate(terms.annualRatePercent);
  const made = Math.min(Math.max(afterPayments, 0), terms.months);
  const balance =
    rate === 0
      ? principal - payment * made
      : principal * Math.pow(1 + rate, made) - (payment * (Math.pow(1 + rate, made) - 1)) / rate;
  return money(Math.max(balance, 0), terms.principal.currency);
}

/** Months and interest until the balance is repaid when paying `installment + extra` each month. */
function payoff(terms: LoanTerms, extraPerMonth: Money): LoanPayoff | null {
  const monthlyInstallment = installment(terms.principal, terms.annualRatePercent, terms.months);
  if (!monthlyInstallment) return null;
  const rate = monthlyRate(terms.annualRatePercent);
  const payment = add(monthlyInstallment, extraPerMonth).minorUnits / 100;
  let balance = terms.principal.minorUnits / 100;
  let interest = 0;
  let months = 0;
  while (balance >= REPAID_THRESHOLD && months < terms.months * 2) {
    const monthInterest = balance * rate;
    interest += monthInterest;
    balance = balance + monthInterest - payment;
    months += 1;
  }
  return { months, interest: money(interest, terms.principal.currency) };
}

function compareLoans(current: LoanTerms, offer: LoanTerms): LoanComparison {
  const currentCost = cost(current);
  const offerCost = cost(offer);
  const switchingCost = multiply(current.principal, current.earlyRepaymentPenaltyPercent / 100);
  return new LoanComparison(currentCost, offerCost, switchingCost, verdict(currentCost, offerCost, switchingCost));
}

function verdict(current: LoanCost | null, offer: LoanCost | null, switchingCost: Money): LoanVerdict {
  if (!current || !offer) return 'insufficientInformation';
  const difference = subtract(add(offer.totalRepayable, switchingCost), current.totalRepayable);
  const negligible = money(NEGLIGIBLE_LOAN_DIFFERENCE, difference.currency);
  if (compare(difference, negate(negligible)) < 0) return 'potentiallyBeneficial';
  if (compare(offer.monthlyPayment, current.monthlyPayment) < 0 && offer.months > current.months) {
    return 'lowerPaymentLongerCommitment';
  }
  return compare(difference, negligible) > 0 ? 'moreExpensiveOverall' : 'similarCost';
}

function monthlyRate(annualRatePercent: number): number {
  return annualRatePercent / 100 / 12;
}

function rawInstallment(principal: number, annualRatePercent: number, months: number): number | null {
  if (months <= 0 || principal <= 0 || annualRatePercent < 0) return null;
  const rate = monthlyRate(annualRatePercent);
  if (rate === 0) return principal / months;
  return (principal * rate) / (1 - Math.pow(1 + rate, -months));
}

/** Solves the annuity formula for the number of months left, given the balance and the monthly payment. */
export function remainingMonths(balance: number, annualRatePercent: number, monthlyPayment: number): number | null {
  if (balance <= 0 || monthlyPayment <= 0 || annualRatePercent < 0) return null;
  const rate = monthlyRate(annualRatePercent);
  if (rate === 0) return Math.ceil(balance / monthlyPayment - ROUNDING_TOLERANCE_MONTHS);
  const interestShare = (rate * balance) / monthlyPayment;
  // A payment that doesn't cover the interest never repays the loan.
  if (interestShare >= 1) return null;
  const months = -Math.log(1 - interestShare) / Math.log(1 + rate);
  // Payments rounded to the tetri leave a sliver of a month; that isn't another installment.
  return Math.ceil(months - ROUNDING_TOLERANCE_MONTHS);
}

/**
 * Standard annuity maths (equal monthly installments) with fees layered on top.
 * Results are estimates: real contracts can differ in day counts, rounding, and fee timing.
 */
export const LoanCalculator = {
  installment,
  cost,
  remainingPrincipal,
  payoff,
  compare: compareLoans,
};
