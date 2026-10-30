import { addDays, addMonths, daysInMonth, dateParts, startOfMonth, tbilisiDate } from './calendar.ts';
import { lt } from './localization.ts';
import { loanTerms, type LoanTerms } from './loan.ts';
import { gel, money, type Money } from './money.ts';
import type { CompletedRecommendation, Lesson } from './rewards.ts';
import type { SavingsGoal } from './savingsGoal.ts';

/**
 * App-side data the bank can't know, kept from the iOS prototype's SampleData. Everything the iOS app
 * hard-coded about money coming in and going out is derived from TBC data instead (see bankMapping.ts).
 * Dates are relative to `now`, so a fresh install sees the same picture the iOS sample month showed.
 */

/** The demo persona. The bank snapshot carries no owner name, and personal info holds only ID and phone. */
export const SAMPLE_PROFILE = {
  firstName: lt('Nino', 'ნინო'),
  fullName: lt('Nino Nadiradze', 'ნინო ნადირაძე'),
  initials: 'NN',
} as const;

export const DEFAULT_DELIVERY_MONTHLY_BUDGET = gel(200);
/** The iOS demo starts with three of the five free AI answers used, so the paywall is easy to reach. */
export const DEFAULT_AI_RECOMMENDATIONS_USED = 3;
export const DEFAULT_COMPLETED_LESSONS: readonly Lesson[] = ['needsVersusWants'];
/** Lifetime total of the completed-recommendation history below; the app has no older records. */
export const SAVED_VIA_RECOMMENDATIONS_ALL_TIME = gel(340);
/** TBC doesn't report early-repayment fees; 1% matches the iOS sample and common Georgian consumer loans. */
export const ASSUMED_EARLY_REPAYMENT_PENALTY_PERCENT = 1;

/** The three starter goals, with target dates at the same month-ends the iOS sample used for October. */
export function defaultGoals(now: Date): SavingsGoal[] {
  return [
    {
      id: 'safety-cushion',
      name: lt('Safety cushion', 'ფინანსური ბალიში'),
      icon: 'shield',
      target: gel(4000),
      saved: gel(2650),
      targetDate: endOfMonthAfter(now, 2),
      monthlyContribution: gel(450),
      priority: 'high',
    },
    {
      id: 'japan-adventure',
      name: lt('Japan adventure', 'მოგზაურობა იაპონიაში'),
      icon: 'travel',
      target: gel(6000),
      saved: gel(3800),
      targetDate: endOfMonthAfter(now, 6),
      monthlyContribution: gel(450),
      priority: 'medium',
    },
    {
      id: 'home-in-tbilisi',
      name: lt('Home in Tbilisi', 'ბინა თბილისში'),
      icon: 'home',
      target: gel(30000),
      saved: gel(8400),
      targetDate: endOfMonthAfter(now, 26),
      monthlyContribution: gel(100),
      priority: 'low',
    },
  ];
}

/** Recommendations the persona followed recently (2, 11 and 20 days ago, as in the iOS sample). */
export function defaultCompletedRecommendations(now: Date): CompletedRecommendation[] {
  return [
    {
      id: 'pickup',
      title: lt('Picked up instead of delivery', 'შეკვეთა თავად წაიღე'),
      saved: gel(6),
      date: noonDaysBefore(now, 2),
    },
    {
      id: 'batch',
      title: lt('Cooked a double batch on Sunday', 'კვირას ორმაგი ულუფა მოამზადე'),
      saved: gel(30),
      date: noonDaysBefore(now, 11),
    },
    {
      id: 'addon',
      title: lt("Paused an add-on you didn't use", 'გამოუყენებელი დამატება შეაჩერე'),
      saved: gel(12),
      date: noonDaysBefore(now, 20),
    },
  ];
}

/** A refinancing offer for the current balance: a lower rate, but a longer term and fees. */
export function refinanceOffer(principal: Money): LoanTerms {
  return loanTerms({
    name: lt('New offer', 'ახალი შეთავაზება'),
    principal,
    annualRatePercent: 16,
    months: 60,
    upfrontFeePercent: 2.5,
    monthlyFee: money(3, principal.currency),
    monthlyInsurance: money(4, principal.currency),
  });
}

function endOfMonthAfter(now: Date, months: number): Date {
  const month = addMonths(startOfMonth(now), months);
  const { year, month: monthNumber } = dateParts(month);
  return tbilisiDate(year, monthNumber, daysInMonth(month));
}

function noonDaysBefore(now: Date, days: number): Date {
  const { year, month, day } = dateParts(addDays(now, -days));
  return tbilisiDate(year, month, day);
}
