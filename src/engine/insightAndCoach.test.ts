import { describe, expect, it } from 'vitest';
import { deriveSpendingHistory } from './bankMapping.ts';
import { CATEGORY_META } from './categories.ts';
import { COACH_QUESTIONS, CoachScript, coachSuggestions } from './coachScript.ts';
import { sampleConverter } from './currencyConverter.ts';
import { createDisplay } from './display.ts';
import { EMPTY_HISTORY } from './history.ts';
import { INSIGHT_KINDS, InsightBuilder, monthSpendingChange } from './insights.ts';
import type { AppLanguage } from './localization.ts';
import { gel } from './money.ts';
import type { SavingsGoal } from './savingsGoal.ts';
import { FIXTURE_NOW, sampleFinance, sampleGoals, sampleTransactions } from './testFixtures.ts';

const finance = sampleFinance();
const history = deriveSpendingHistory(sampleTransactions(), FIXTURE_NOW, sampleConverter);

function insights(language: AppLanguage = 'en'): InsightBuilder {
  return new InsightBuilder(finance, createDisplay(language), history);
}

function coach(language: AppLanguage = 'en', goal: SavingsGoal | null = sampleGoals()[0]): CoachScript {
  return new CoachScript(finance, goal, createDisplay(language), history);
}

describe('Insights', () => {
  it('derives delivery figures from data', () => {
    const builder = insights();
    expect(builder.deliveryThisMonth).toEqual(gel(185));
    expect(builder.deliveryRecentAverage).toEqual(gel(130));
    expect(builder.suggestedWeeklyDeliveryBudget).toEqual(gel(30));
  });

  it('computes the weekend premium from the bank history', () => {
    expect(insights().weekendFoodPremiumPercent).toBe(24);
  });

  it('delivery insight quotes the real numbers', () => {
    const content = insights().content('deliveryIncrease');
    expect(content.summary).toContain('185');
    expect(content.summary).toContain('55');
    expect(content.bars).toHaveLength(3);
    expect(content.bars.at(-1)?.isHighlighted).toBe(true);
    expect(content.relatedTransactions.every((transaction) => transaction.category === 'foodDelivery')).toBe(true);
  });

  it('names the history months instead of hard-coding them', () => {
    expect(insights().content('deliveryIncrease').method).toContain('compared them with August and September');
    expect(insights('ka').content('deliveryIncrease').method).toContain('შევადარეთ აგვისტოსა და სექტემბერს');
    expect(insights().content('weekendPattern').dataBasis).toBe('Based on 3 months of your transactions (Aug – Oct).');
  });

  it('insights link to the transactions behind them', () => {
    const builder = insights();
    expect(builder.content('subscriptions').relatedTransactions).toHaveLength(3);
    expect(builder.content('recurringMerchant').relatedTransactions).toHaveLength(4);
    expect(builder.content('recurringMerchant').title).toBe('Wolt is a regular');
    expect(builder.content('unusualExpense').relatedTransactions[0]?.merchant).toBe('Zara');
    expect(builder.content('unusualExpense').summary).toContain('about 3×');
    expect(builder.content('planProgress').relatedTransactions).toHaveLength(5);
  });

  it('every insight has Georgian copy', () => {
    const english = insights('en');
    const georgian = insights('ka');
    for (const kind of INSIGHT_KINDS) {
      expect(english.content(kind).title).not.toBe(georgian.content(kind).title);
      expect(georgian.content(kind).method).not.toBe('');
    }
  });

  it('falls back gracefully without bank history', () => {
    const builder = new InsightBuilder(finance, createDisplay('en'), EMPTY_HISTORY);
    expect(builder.deliveryRecentAverage).toEqual(gel(0));
    expect(builder.content('deliveryIncrease').method).toContain('compared them with previous months');
    expect(builder.content('weekendPattern').dataBasis).toBe('Based on your transactions, 1 Oct – 29 Oct.');
  });

  it('compares this month with the last one', () => {
    expect(monthSpendingChange(gel(2158.97), gel(2240))).toEqual({ percent: 4, isLower: true });
    expect(monthSpendingChange(gel(2500), gel(2000))).toEqual({ percent: 25, isLower: false });
    expect(monthSpendingChange(gel(2500), null)).toBeNull();
  });
});

describe('Coach script', () => {
  it('weekly allowance reply uses the safe-to-spend amount', () => {
    const reply = coach().reply('weeklyAllowance');
    expect(reply.text).toContain('123');
    expect(reply.supportingTransactions.every((transaction) => !CATEGORY_META[transaction.category].isFixedCost)).toBe(true);
  });

  it('goal reply is marked as an estimate', () => {
    const reply = coach().reply('saveForGoal');
    expect(reply.isEstimate).toBe(true);
    expect(reply.text).toContain('150');
  });

  it('goal reply without a goal asks to create one', () => {
    const reply = coach('en', null).reply('saveForGoal');
    expect(reply.isEstimate).toBe(false);
    expect(reply.followUps).toEqual(['weeklyAllowance']);
  });

  it('goal prompt uses the goal target', () => {
    expect(coach().prompt('saveForGoal')).toContain('4,000');
  });

  it('spending reply is honest that overall spending fell', () => {
    const reply = coach().reply('whySpendMore');
    expect(reply.text).toContain('less than last month');
    expect(reply.supportingTransactions).toHaveLength(5);
    expect(reply.reasoning).toContain('2,240');
  });

  it('compares with last month from the bank history', () => {
    const reply = coach().reply('compareLastMonth');
    expect(reply.text).toContain('Last month: 2,240');
    expect(reply.text).toContain('versus 142');
  });

  it('says so when the bank data does not reach last month', () => {
    const script = new CoachScript(finance, sampleGoals()[0], createDisplay('en'), EMPTY_HISTORY);
    expect(script.reply('compareLastMonth').text).toContain("doesn't cover last month");
    expect(script.reply('whySpendMore').text).toContain("can't compare overall spending");
  });

  it('coaching-off message points to the setting', () => {
    expect(coach().coachingDataOff).toContain('Data-sharing permissions');
    expect(coach('ka').coachingDataOff).toContain('ნებართვები');
  });

  it('every question offers follow-ups', () => {
    for (const question of COACH_QUESTIONS) {
      expect(coach().reply(question).followUps.length).toBeGreaterThan(0);
    }
  });

  it('suggests follow-ups to the last answer, or every question to start with', () => {
    expect(coachSuggestions(null, coach())).toEqual(COACH_QUESTIONS);
    expect(coachSuggestions('compareLastMonth', coach())).toEqual(['whySpendMore']);
  });
});
