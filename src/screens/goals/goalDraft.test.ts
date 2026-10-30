import { describe, expect, it } from 'vitest';
import { addMonths, createDisplay, gel, lt } from '../../engine/index.ts';
import { FIXTURE_NOW as now, sampleGoals } from '../../engine/testFixtures.ts';
import { DEFAULT_GOAL_MONTHS, editedGoal, goalDraftFrom, newGoalDraft } from './goalDraft.ts';

const english = createDisplay('en');
const georgian = createDisplay('ka');
const [cushion] = sampleGoals();

describe('newGoalDraft', () => {
  it('starts empty with the iOS defaults', () => {
    expect(newGoalDraft(now, null)).toEqual({
      name: '',
      icon: 'travel',
      targetText: '',
      savedText: '',
      monthlyText: '',
      targetDate: addMonths(now, DEFAULT_GOAL_MONTHS),
      priority: 'medium',
    });
  });

  it('fills in the onboarding savings target as whole lari', () => {
    expect(newGoalDraft(now, gel(5000.75)).targetText).toBe('5000');
  });
});

describe('goalDraftFrom', () => {
  it('shows the goal in the active language', () => {
    expect(goalDraftFrom(cushion, english)).toEqual({
      name: 'Safety cushion',
      icon: 'shield',
      targetText: '4000',
      savedText: '2650',
      monthlyText: '450',
      targetDate: cushion.targetDate,
      priority: 'high',
    });
    expect(goalDraftFrom(cushion, georgian).name).toBe('ფინანსური ბალიში');
  });

  it('leaves zero amounts blank', () => {
    const draft = goalDraftFrom({ ...cushion, saved: gel(0), monthlyContribution: gel(0) }, english);
    expect(draft.savedText).toBe('');
    expect(draft.monthlyText).toBe('');
  });
});

describe('editedGoal', () => {
  it('keeps the id and both translations of an untouched name', () => {
    const fields = { ...goalDraftFrom(cushion, english), targetText: '5000' };
    expect(editedGoal(cushion, fields, english)).toEqual({ ...cushion, target: gel(5000) });
  });

  it('uses a renamed goal in both languages', () => {
    const fields = { ...goalDraftFrom(cushion, english), name: '  Rainy day  ' };
    expect(editedGoal(cushion, fields, english)?.name).toEqual(lt('Rainy day', 'Rainy day'));
  });

  it('rejects an incomplete or inconsistent form', () => {
    const fields = goalDraftFrom(cushion, english);
    expect(editedGoal(cushion, { ...fields, name: ' ' }, english)).toBeNull();
    expect(editedGoal(cushion, { ...fields, targetText: '' }, english)).toBeNull();
    expect(editedGoal(cushion, { ...fields, savedText: '4000' }, english)).toBeNull();
  });
});
