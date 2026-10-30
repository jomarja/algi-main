import type { CoachRecommendation } from '../../../../shared/coach.ts';
import { createDisplay, NON_BREAKING_SPACE } from '../../../engine/index.ts';
import { actionTitle, monthlyImpactText } from './presentation.ts';

const recommendation: CoachRecommendation = {
  id: 'rec-1',
  title: 'Trim delivery',
  detail: 'Two fewer orders a month.',
  impactMonthly: 60,
  category: 'foodDelivery',
  action: 'review_budget',
  evidence: ['Food delivery this month: 186.40 ₾'],
  priority: 'medium',
};

describe('monthlyImpactText', () => {
  it('states the estimated monthly impact in the display currency', () => {
    expect(monthlyImpactText(recommendation, createDisplay('en', 'GEL'))).toBe(`About 60${NON_BREAKING_SPACE}₾ a month`);
    expect(monthlyImpactText(recommendation, createDisplay('ka', 'GEL'))).toBe(`თვეში დაახლოებით 60${NON_BREAKING_SPACE}₾`);
  });

  it('says nothing when there is no estimate', () => {
    expect(monthlyImpactText({ ...recommendation, impactMonthly: null }, createDisplay('en', 'GEL'))).toBeNull();
  });
});

describe('actionTitle', () => {
  it('names the screen the button opens, or nothing for good news', () => {
    expect(actionTitle('compare_loan')).toEqual({ en: 'Compare loans', ka: 'სესხების შედარება' });
    expect(actionTitle('none')).toBeNull();
  });
});
