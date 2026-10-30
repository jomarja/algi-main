import { describe, expect, it } from 'vitest';
import { addMonths, tbilisiDate } from './calendar.ts';
import { lt } from './localization.ts';
import { gel, zero } from './money.ts';
import { celebratedMilestone, goalFromDraft, GoalProjection, type SavingsGoal } from './savingsGoal.ts';
import { FIXTURE_NOW as now } from './testFixtures.ts';

function goal({ saved = 2650, monthly = 450, due = tbilisiDate(2026, 12, 31) } = {}): SavingsGoal {
  return {
    id: 'cushion',
    name: lt('Safety cushion', 'ფინანსური ბალიში'),
    icon: 'shield',
    target: gel(4000),
    saved: gel(saved),
    targetDate: due,
    monthlyContribution: gel(monthly),
    priority: 'high',
  };
}

describe('GoalProjection', () => {
  it('calculates remaining and progress', () => {
    const projection = new GoalProjection(goal(), now);
    expect(projection.remaining).toEqual(gel(1350));
    expect(projection.progress).toBe(0.6625);
  });

  it('counts whole days to the target date', () => {
    expect(new GoalProjection(goal(), now).daysRemaining).toBe(63);
  });

  it('rounds required contributions up', () => {
    const projection = new GoalProjection(goal(), now);
    expect(projection.requiredWeekly).toEqual(gel(150));
    expect(projection.requiredMonthly.minorUnits).toBe(65_229);
  });

  it('flags a goal that is slightly behind', () => {
    expect(new GoalProjection(goal(), now).status).toBe('slightlyBehind');
  });

  it('flags a goal that is on track', () => {
    expect(new GoalProjection(goal({ monthly: 700 }), now).status).toBe('onTrack');
  });

  it('flags an unlikely goal without contributions', () => {
    const projection = new GoalProjection(goal({ monthly: 0 }), now);
    expect(projection.status).toBe('unlikely');
    expect(projection.completionDate(zero('GEL'))).toBeNull();
  });

  it('recognizes a reached goal', () => {
    const projection = new GoalProjection(goal({ saved: 4000 }), now);
    expect(projection.status).toBe('reached');
    expect(projection.remaining).toEqual(zero('GEL'));
    expect(projection.completionDate(gel(450))).toEqual(now);
  });

  it('estimates the completion date', () => {
    expect(new GoalProjection(goal(), now).completionDate(gel(450))).toEqual(addMonths(now, 3));
  });

  it('requires the full remainder when the date has passed', () => {
    const projection = new GoalProjection(goal({ due: tbilisiDate(2026, 10, 1) }), now);
    expect(projection.daysRemaining).toBe(0);
    expect(projection.requiredMonthly).toEqual(gel(1350));
  });

  it('builds three scenarios', () => {
    const scenarios = new GoalProjection(goal(), now).scenarios(gel(80));
    expect(scenarios.map((scenario) => scenario.kind)).toEqual(['current', 'conservative', 'revised']);
    expect(scenarios.map((scenario) => scenario.monthlyContribution)).toEqual([gel(450), gel(337.5), gel(530)]);
  });

  it('plots monthly checkpoints ending on the target date', () => {
    const target = tbilisiDate(2026, 12, 31);
    const points = new GoalProjection(goal({ due: target }), now).checkpoints(gel(450));
    expect(points).toHaveLength(4);
    expect(points[0].saved).toEqual(gel(2650));
    expect(points[1].saved).toEqual(gel(3100));
    expect(points.at(-1)?.date).toEqual(target);
  });
});

describe('Goal milestones and drafts', () => {
  it('celebrates the largest milestone crossed', () => {
    expect(celebratedMilestone(0.4, 0.55)).toBe(0.5);
    expect(celebratedMilestone(0.4, 0.8)).toBe(0.75);
    expect(celebratedMilestone(0.55, 0.6)).toBeNull();
    expect(celebratedMilestone(0.9, 1)).toBe(1);
  });

  const fields = {
    name: '  New laptop ',
    icon: 'laptop',
    targetText: '2 500',
    savedText: '',
    monthlyText: '200',
    targetDate: tbilisiDate(2027, 6, 30),
    priority: 'medium',
  } as const;

  it('builds a goal from valid fields', () => {
    const draft = goalFromDraft(fields, 'laptop-goal');
    expect(draft).toEqual({
      id: 'laptop-goal',
      name: lt('New laptop', 'New laptop'),
      icon: 'laptop',
      target: gel(2500),
      saved: zero('GEL'),
      targetDate: fields.targetDate,
      monthlyContribution: gel(200),
      priority: 'medium',
    });
  });

  it('rejects a missing name, a missing target, or savings that already cover the target', () => {
    expect(goalFromDraft({ ...fields, name: '   ' })).toBeNull();
    expect(goalFromDraft({ ...fields, targetText: '0' })).toBeNull();
    expect(goalFromDraft({ ...fields, savedText: '2500' })).toBeNull();
  });
});
