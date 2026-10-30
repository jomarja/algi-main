import { describe, expect, it } from 'vitest';
import { addDays, createDisplay, gel, GoalProjection, lt } from '../../engine/index.ts';
import type { GoalScenario, SavingsGoal } from '../../engine/index.ts';
import { FIXTURE_NOW as now } from '../../engine/testFixtures.ts';
import { milestoneCelebration, needsNewPace, reachesTargetOnTime, weeklyGap } from './goalModel.ts';

/** 1,000 ₾ in exactly ten weeks: 100 ₾ a week is needed. */
const trip: SavingsGoal = {
  id: 'trip',
  name: lt('Trip', 'მოგზაურობა'),
  icon: 'travel',
  target: gel(1000),
  saved: gel(0),
  targetDate: addDays(now, 70),
  monthlyContribution: gel(0),
  priority: 'medium',
};

function gapFor(monthlyContribution: number) {
  const goal = { ...trip, monthlyContribution: gel(monthlyContribution) };
  return weeklyGap(goal, new GoalProjection(goal, now));
}

describe('needsNewPace', () => {
  it('is true only when the goal is behind or unlikely', () => {
    expect(needsNewPace('slightlyBehind')).toBe(true);
    expect(needsNewPace('unlikely')).toBe(true);
    expect(needsNewPace('onTrack')).toBe(false);
    expect(needsNewPace('reached')).toBe(false);
  });
});

describe('weeklyGap', () => {
  it('is everything needed a week without a contribution', () => {
    expect(gapFor(0)).toEqual(gel(100));
  });

  it('subtracts the weekly share of the monthly contribution', () => {
    // 217.43 ₾ a month is 50 ₾ a week.
    expect(gapFor(217.43)).toEqual(gel(50));
  });

  it('never goes below zero', () => {
    expect(gapFor(1000)).toEqual(gel(0));
  });
});

describe('reachesTargetOnTime', () => {
  const scenario = (projected: number): GoalScenario => ({
    kind: 'current',
    monthlyContribution: gel(100),
    projectedAtTargetDate: gel(projected),
    completionDate: null,
  });

  it('compares the projection at the target date with the target', () => {
    expect(reachesTargetOnTime(scenario(1000), trip)).toBe(true);
    expect(reachesTargetOnTime(scenario(1200), trip)).toBe(true);
    expect(reachesTargetOnTime(scenario(999.99), trip)).toBe(false);
  });
});

describe('milestoneCelebration', () => {
  it('celebrates a share of the way', () => {
    expect(milestoneCelebration(0.75, trip, createDisplay('en'))).toEqual({
      title: '75% of the way there!',
      message: 'Trip just passed a milestone. Small steps add up.',
    });
  });

  it('celebrates reaching the goal', () => {
    expect(milestoneCelebration(1, trip, createDisplay('en')).title).toBe('Goal reached!');
    expect(milestoneCelebration(1, trip, createDisplay('ka')).title).toBe('მიზანი მიღწეულია!');
  });

  it('speaks Georgian', () => {
    expect(milestoneCelebration(0.5, trip, createDisplay('ka'))).toEqual({
      title: 'გზის 50% გავლილია!',
      message: '„მოგზაურობა“-მა ახალ ეტაპს მიაღწია. პატარა ნაბიჯები ერთად დიდ შედეგს იძლევა.',
    });
  });
});
