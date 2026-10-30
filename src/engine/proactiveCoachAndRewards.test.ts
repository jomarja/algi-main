import { describe, expect, it } from 'vitest';
import { currentLoanTerms, deriveBankData } from './bankMapping.ts';
import { sampleConverter } from './currencyConverter.ts';
import { createDisplay } from './display.ts';
import { LoanCalculator } from './loan.ts';
import { ProactiveCoach } from './proactiveCoach.ts';
import { isEarned, LESSONS, RewardsBuilder, type RewardsInput } from './rewards.ts';
import { refinanceOffer } from './sampleData.ts';
import {
  FIXTURE_NOW as now,
  ORIGINAL_LOAN,
  SAMPLE_BANK_LOAN,
  sampleBudget,
  sampleFinance,
  sampleGoals,
  sampleTransactions,
} from './testFixtures.ts';

const goals = sampleGoals();
const data = deriveBankData(sampleTransactions(), [SAMPLE_BANK_LOAN], now, sampleConverter);
const loan = currentLoanTerms([SAMPLE_BANK_LOAN], sampleConverter);

const coach = new ProactiveCoach({
  finance: sampleFinance(),
  budget: sampleBudget(),
  goals,
  upcomingPayments: data.upcomingPayments,
  loanComparison: loan ? LoanCalculator.compare(loan, refinanceOffer(loan.principal)) : null,
  display: createDisplay('en'),
  history: data.history,
});

function rewards(overrides: Partial<RewardsInput> = {}): RewardsBuilder {
  return new RewardsBuilder({
    goals,
    originalLoanPrincipal: ORIGINAL_LOAN.principal,
    loanRemaining: loan?.principal ?? null,
    savingStreakMonths: data.history.savingStreakMonths,
    hasReviewedBudget: false,
    hasComparedLoan: false,
    completedLessons: ['needsVersusWants'],
    ...overrides,
  });
}

describe('Proactive coach', () => {
  it('ranks the goal at risk first', () => {
    const first = coach.recommendations[0];
    expect(first?.id).toBe(`goal-at-risk-${goals[0].id}`);
    expect(first?.destination.kind).toBe('goalPlanner');
    if (first?.destination.kind !== 'goalPlanner') return;
    expect(first.destination.request?.goalId).toBe(goals[0].id);
  });

  it('suggests every relevant action', () => {
    const ids = coach.recommendations.map((recommendation) => recommendation.id);
    expect(ids).toEqual([
      `goal-at-risk-${goals[0].id}`,
      'flexible-adjustment',
      'upcoming-rent',
      'loan-offer',
      `goal-ahead-${goals[1].id}`,
      'delivery-trend',
    ]);
  });

  it('flexible adjustment only touches flexible categories', () => {
    const suggestion = coach.recommendation('flexible-adjustment');
    expect(suggestion?.title).toContain('60');
    expect(suggestion?.figures.map((figure) => figure.label)).toEqual(['Food & drink', 'Food delivery']);
    expect(
      suggestion?.transactions.every((transaction) => transaction.category === 'foodAndDrink' || transaction.category === 'foodDelivery'),
    ).toBe(true);
  });

  it('upcoming payment reminder uses real balances', () => {
    const suggestion = coach.recommendation('upcoming-rent');
    expect(suggestion?.figures.some((figure) => figure.value.includes('1,230'))).toBe(true);
    expect(suggestion?.figures.some((figure) => figure.value.includes('2,486'))).toBe(true);
    expect(suggestion?.assumptions.some((assumption) => assumption.includes('estimated'))).toBe(true);
  });

  it('loan suggestion shows the trade-off', () => {
    const suggestion = coach.recommendation('loan-offer');
    expect(suggestion?.explanation).toContain('35 months longer');
    expect(suggestion?.destination).toEqual({ kind: 'loanComparison' });
  });

  it('goal ahead is about a month early', () => {
    expect(coach.recommendation(`goal-ahead-${goals[1].id}`)?.title).toContain('about a month early');
  });

  it('skips the loan offer when the bank reports no loan', () => {
    const withoutLoan = new ProactiveCoach({ ...coach.input, loanComparison: null });
    expect(withoutLoan.recommendation('loan-offer')).toBeNull();
  });
});

describe('Rewards', () => {
  it('rewards progress rather than low spending', () => {
    const achievements = new Map(rewards().achievements.map((achievement) => [achievement.id, achievement]));
    expect(achievements.get('first-thousand')?.progress).toBe(1);
    expect(achievements.get('streak')?.progress).toBe(1);
    expect(achievements.get('halfway')?.progress).toBe(1);
    expect(achievements.get('essentials')?.progress).toBe(0);
    expect(achievements.get('money-basics')?.progress).toBe(1 / 3);
  });

  it('tracks loan repayment', () => {
    const builder = rewards();
    expect(builder.loanRepaidShare).toBeGreaterThan(0.38);
    expect(builder.loanRepaidShare).toBeLessThan(0.39);
    expect(builder.achievements.find((achievement) => achievement.id === 'loan-half')?.progress).toBeLessThan(1);
  });

  it('shows no loan progress without the original amount', () => {
    expect(rewards({ originalLoanPrincipal: null }).loanRepaidShare).toBe(0);
  });

  it('earns achievements from actions', () => {
    const earned = rewards({ hasReviewedBudget: true, hasComparedLoan: true, completedLessons: LESSONS })
      .achievements.filter(isEarned)
      .map((achievement) => achievement.id);
    expect(earned).toEqual(expect.arrayContaining(['essentials', 'loan-detective', 'money-basics']));
  });
});
