import {
  add,
  ASSUMED_EARLY_REPAYMENT_PENALTY_PERCENT,
  gel,
  loanTerms,
  lt,
  majorUnits,
  negate,
  parseMoney,
  refinanceOffer,
  type LoanComparison,
  type LoanTerms,
  type Money,
} from '../../../engine/index.ts';
import type { BankState } from '../../../state/appState.ts';

/** Term stepper bounds in months (LoanComparisonView.swift). */
export const TERM_RANGE = { min: 1, max: 360 } as const;

/** Where the user types their own loan when the bank reported none: everything to fill in. */
export function blankCurrentLoan(): LoanTerms {
  return loanTerms({
    name: lt('Current loan', 'მიმდინარე სესხი'),
    principal: gel(0),
    annualRatePercent: 0,
    months: 12,
    earlyRepaymentPenaltyPercent: ASSUMED_EARLY_REPAYMENT_PENALTY_PERCENT,
  });
}

/** The sample refinancing terms without an amount, to compare against a loan the user enters. */
export function blankOffer(): LoanTerms {
  return refinanceOffer(gel(0));
}

/** A number typed into a loan field: "12,5" and "1 240" work, an empty field is 0, anything else is null. */
export function parseFieldNumber(text: string): number | null {
  if (text.trim() === '') return 0;
  const parsed = parseMoney(text, 'GEL');
  return parsed ? majorUnits(parsed) : null;
}

/** A field's value as typed text: up to two decimals, no grouping, so it parses back unchanged. */
export function formatFieldNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** What switching costs in total: the offer's total plus the early repayment fee on the current loan. */
export function offerTotalWithSwitching(comparison: LoanComparison): Money | null {
  return comparison.offer ? add(comparison.offer.totalRepayable, comparison.switchingCost) : null;
}

/** When switching lowers the payment but stretches the debt: what it frees each month and for how much longer. */
export function switchingBudgetEffect(comparison: LoanComparison): { readonly freedMonthly: Money; readonly extraMonths: number } | null {
  const monthly = comparison.monthlyDifference;
  const extraMonths = comparison.extraMonths;
  if (!monthly || extraMonths === null || monthly.minorUnits >= 0 || extraMonths <= 0) return null;
  return { freedMonthly: negate(monthly), extraMonths };
}

/** Whether the bank has answered (or failed), so a missing loan means there's none to prefill rather than not yet. */
export function hasBankAnswered(bank: Pick<BankState, 'status' | 'snapshot' | 'sync'>): boolean {
  if (bank.snapshot !== null || bank.sync === 'error') return true;
  return bank.status !== null && bank.sync !== 'loading';
}
