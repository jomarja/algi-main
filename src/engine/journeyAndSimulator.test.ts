import { describe, expect, it } from 'vitest';
import { currentLoanTerms } from './bankMapping.ts';
import { addMonths, tbilisiDate } from './calendar.ts';
import { sampleConverter } from './currencyConverter.ts';
import { createDisplay } from './display.ts';
import { checkpointCelebration, isDestination, Journey, journeyDuration } from './journey.ts';
import { lt } from './localization.ts';
import { gel } from './money.ts';
import type { SavingsGoal } from './savingsGoal.ts';
import { FIXTURE_NOW as now, SAMPLE_BANK_LOAN, sampleBudget } from './testFixtures.ts';
import { isOutcomeAffordable, isOutcomeTight, WhatIfSimulator } from './whatIf.ts';

const display = createDisplay('en');

function goal({ saved = 2650, monthly = 450, target = 4000, due = tbilisiDate(2026, 12, 31) } = {}): SavingsGoal {
  return {
    id: 'cushion',
    name: lt('Safety cushion', 'ფინანსური ბალიში'),
    icon: 'shield',
    target: gel(target),
    saved: gel(saved),
    targetDate: due,
    monthlyContribution: gel(monthly),
    priority: 'high',
  };
}

describe('Journey', () => {
  it('places eight checkpoints along the path', () => {
    const journey = new Journey(goal(), now);
    expect(journey.milestones.map((milestone) => milestone.amount)).toEqual(
      [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000].map((amount) => gel(amount)),
    );
    expect(isDestination(journey.milestones[7])).toBe(true);
  });

  it('marks reached, current and upcoming checkpoints', () => {
    const journey = new Journey(goal(), now);
    expect(journey.reachedCount).toBe(5);
    expect(journey.nextMilestone?.amount).toEqual(gel(3000));
    expect(journey.amountToNextMilestone).toEqual(gel(350));
    expect(journey.milestones.filter((milestone) => milestone.state === 'current')).toHaveLength(1);
  });

  it('reports being behind schedule', () => {
    expect(new Journey(goal(), now).schedule).toEqual({ kind: 'behind', days: 29 });
  });

  it('reports being ahead of schedule', () => {
    const japan = goal({ saved: 3800, monthly: 450, target: 6000, due: tbilisiDate(2027, 4, 30) });
    expect(new Journey(japan, now).schedule).toEqual({ kind: 'ahead', days: 32 });
  });

  it('treats a few days as on schedule', () => {
    expect(new Journey(goal({ saved: 3100 }), now).schedule).toEqual({ kind: 'onSchedule' });
  });

  it('recognizes arrival and stalled journeys', () => {
    expect(new Journey(goal({ saved: 4000 }), now).schedule).toEqual({ kind: 'arrived' });
    expect(new Journey(goal({ monthly: 0 }), now).schedule).toEqual({ kind: 'notMoving' });
  });

  it('describes durations in friendly units', () => {
    expect(journeyDuration(10, display)).toBe('1 week');
    expect(journeyDuration(29, display)).toBe('1 month');
    expect(journeyDuration(800, display)).toBe('2 years');
    expect(journeyDuration(29, createDisplay('ka'))).toBe('1 თვით');
  });

  it('labels the schedule and its tone', () => {
    const behind = new Journey(goal(), now);
    expect(behind.scheduleLabel(display)).toBe('About 1 month behind');
    expect(behind.scheduleTone).toBe('attention');
    expect(new Journey(goal({ saved: 3100 }), now).scheduleTone).toBe('positive');
  });

  it('Luka stays calm when behind', () => {
    expect(new Journey(goal(), now).reaction(display).pose).toBe('overspending');
    expect(new Journey(goal({ saved: 4000 }), now).reaction(display).pose).toBe('achievement');
  });

  it('suggests the next step for the journey', () => {
    expect(new Journey(goal(), now).nextActionMessage(display)).toContain('to catch up');
    expect(new Journey(goal({ saved: 3100 }), now).nextActionMessage(display)).toContain('next checkpoint in about');
  });

  it('celebrates a new checkpoint and the arrival', () => {
    const before = new Journey(goal(), now);
    expect(checkpointCelebration(before, new Journey(goal({ saved: 2700 }), now), display)).toBeNull();
    expect(checkpointCelebration(before, new Journey(goal({ saved: 3000 }), now), display)?.title).toBe('Checkpoint 6 of 8!');
    expect(checkpointCelebration(before, new Journey(goal({ saved: 4000 }), now), display)?.title).toBe("You've arrived!");
  });
});

describe('What-if', () => {
  const simulator = new WhatIfSimulator(sampleBudget(), goal(), currentLoanTerms([SAMPLE_BANK_LOAN], sampleConverter), now);

  it('baseline matches the current plan', () => {
    const outcome = simulator.outcome(simulator.baseline);
    expect(outcome.roomLeft).toEqual(gel(314.43));
    expect(outcome.goalMonthly).toEqual(gel(450));
    expect(outcome.goalCompletion).toEqual(addMonths(now, 3));
    expect(outcome.savedInTwelveMonths).toEqual(gel(1350));
    expect(outcome.loanMonthsLeft).toBe(25);
    expect(isOutcomeAffordable(outcome)).toBe(true);
    expect(isOutcomeTight(outcome)).toBe(false);
  });

  it('saving more reaches the goal sooner but leaves less room', () => {
    const outcome = simulator.outcome({ ...simulator.baseline, goalContribution: gel(700) });
    expect(outcome.goalCompletion).toEqual(addMonths(now, 2));
    expect(outcome.roomLeft).toEqual(gel(64.43));
    expect(isOutcomeTight(outcome)).toBe(true);
  });

  it('cutting delivery adds to the goal without touching room', () => {
    const outcome = simulator.outcome({ ...simulator.baseline, deliveryCut: gel(50) });
    expect(outcome.goalMonthly).toEqual(gel(500));
    expect(outcome.roomLeft).toEqual(gel(314.43));
  });

  it('flags a plan that does not fit after an income drop', () => {
    const outcome = simulator.outcome({ ...simulator.baseline, incomeChangePercent: -10 });
    expect(outcome.roomLeft).toEqual(gel(-25.57));
    expect(isOutcomeAffordable(outcome)).toBe(false);
  });

  it('extra loan payments shorten the debt', () => {
    const outcome = simulator.outcome({ ...simulator.baseline, extraLoanPayment: gel(100) });
    expect(outcome.loanMonthsLeft).toBe(17);
    expect(outcome.loanInterestLeft).toEqual(gel(756.86));
    expect(outcome.roomLeft).toEqual(gel(214.43));
  });

  it('works without a loan', () => {
    const noLoan = new WhatIfSimulator(sampleBudget(), goal(), null, now);
    const outcome = noLoan.outcome(noLoan.baseline);
    expect(outcome.loanMonthsLeft).toBe(0);
    expect(outcome.loanInterestLeft).toEqual(gel(0));
  });
});
