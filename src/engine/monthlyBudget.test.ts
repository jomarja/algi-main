import { describe, expect, it } from 'vitest';
import { DailyAllowance } from './dailyAllowance.ts';
import { compare, gel, multiply, zero } from './money.ts';
import { MAXIMUM_CUT_SHARE, MonthlyBudget, type PriorityOverrides } from './monthlyBudget.ts';
import { sampleBudget } from './testFixtures.ts';

function budget(priorities: PriorityOverrides = {}): MonthlyBudget {
  const base = sampleBudget();
  return new MonthlyBudget({ income: base.income, lines: base.lines, savingsContributions: gel(1000), priorities });
}

describe('MonthlyBudget', () => {
  it('splits the month into essentials, savings and flexible', () => {
    const month = budget();
    expect(month.essentialTotal).toEqual(gel(1618.44));
    expect(month.flexibleAllowance).toEqual(gel(781.56));
    expect(month.flexibleTotal).toEqual(gel(467.13));
    expect(month.unplannedRoom).toEqual(gel(314.43));
  });

  it('caps sustainable saving at half of flexible spending', () => {
    expect(budget().maximumSustainableSaving).toEqual(gel(548));
  });

  it('derives the monthly and weekly plans iOS hard-coded', () => {
    expect(budget().monthlyPlan).toEqual(gel(2400));
    expect(budget().weeklyPlan).toEqual(gel(280));
    expect(budget().dayToDayEssentialTotal).toEqual(gel(435));
  });

  it('suggests a gentle adjustment from the two largest flexible categories', () => {
    const cuts = budget().gentleAdjustment;
    expect(cuts.map((cut) => cut.category)).toEqual(['foodAndDrink', 'foodDelivery']);
    expect(cuts.map((cut) => cut.monthlySaving)).toEqual([gel(35), gel(25)]);
  });

  it('never cuts essentials', () => {
    const month = budget();
    const cuts = month.cuts(gel(10_000));
    expect(cuts.length).toBeGreaterThan(0);
    expect(cuts.every((cut) => month.priority(cut.category) === 'flexible')).toBe(true);
    expect(
      cuts.every((cut) => {
        const line = month.lines.find((candidate) => candidate.category === cut.category);
        return compare(cut.monthlySaving, multiply(line?.monthlyAmount ?? zero('GEL'), MAXIMUM_CUT_SHARE)) <= 0;
      }),
    ).toBe(true);
  });

  it('takes only what is needed', () => {
    const cuts = budget().cuts(gel(55.57));
    expect(cuts.map((cut) => cut.category)).toEqual(['foodAndDrink']);
    expect(cuts[0]?.monthlySaving).toEqual(gel(60));
    expect(budget().cuts(zero('GEL'))).toEqual([]);
  });

  it('keeps food, housing, health and debt protected whatever the settings', () => {
    const month = budget({ groceries: 'flexible', housing: 'flexible', health: 'flexible', debt: 'flexible' });
    for (const category of ['groceries', 'housing', 'health', 'debt'] as const) {
      expect(month.priority(category)).toBe('essential');
    }
  });

  it("respects the user's other choices", () => {
    const month = budget({ transport: 'flexible', subscriptions: 'essential' });
    expect(month.priority('transport')).toBe('flexible');
    expect(month.priority('subscriptions')).toBe('essential');
    expect(month.flexibleLines.map((line) => line.category)).toContain('transport');
  });
});

describe('DailyAllowance', () => {
  const allowance = new DailyAllowance({
    weeklyRemaining: gel(122.7),
    daysLeft: 4,
    essentialDailyNeed: gel(14.29),
    monthlyGoalContribution: gel(450),
  });

  it('spreads the week over the days left', () => {
    expect(allowance.today).toEqual(gel(30.68));
    expect(allowance.protectedForEssentials).toEqual(gel(57.16));
    expect(allowance.flexibleLeft).toEqual(gel(65.54));
  });

  it('explains the impact of spending today', () => {
    expect(allowance.impact(gel(20))).toEqual({ kind: 'withinAllowance' });
    expect(allowance.impact(gel(60))).toEqual({ kind: 'lowersLaterDays', newDaily: gel(20.9) });
    expect(allowance.impact(gel(200))).toEqual({ kind: 'delaysGoal', days: 6, overspend: gel(77.3) });
  });

  it('never protects more than is left', () => {
    const tight = new DailyAllowance({
      weeklyRemaining: gel(20),
      daysLeft: 4,
      essentialDailyNeed: gel(14.29),
      monthlyGoalContribution: gel(450),
    });
    expect(tight.protectedForEssentials).toEqual(gel(20));
    expect(tight.flexibleLeft).toEqual(zero('GEL'));
  });

  it('reports no delay when nothing goes to the goal', () => {
    const noGoal = new DailyAllowance({
      weeklyRemaining: gel(50),
      daysLeft: 2,
      essentialDailyNeed: gel(10),
      monthlyGoalContribution: zero('GEL'),
    });
    expect(noGoal.impact(gel(80))).toEqual({ kind: 'delaysGoal', days: 0, overspend: gel(30) });
  });
});
