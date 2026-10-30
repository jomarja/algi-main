import { describe, expect, it } from 'vitest';
import { createDisplay } from '../../engine/index.ts';
import { fieldProblem, firstInvalidField, showsFieldError } from './personalInfoFormModel.ts';

const display = createDisplay('en');

describe('showsFieldError', () => {
  const untouched = { submitAttempts: 0, isVisited: false, isFocused: false, value: '123' };

  it('stays quiet before the field has been left', () => {
    expect(showsFieldError(untouched)).toBe(false);
  });

  it('stays quiet while typing, even after a visit', () => {
    expect(showsFieldError({ ...untouched, isVisited: true, isFocused: true })).toBe(false);
  });

  it('shows once a non-empty field has been left', () => {
    expect(showsFieldError({ ...untouched, isVisited: true })).toBe(true);
    expect(showsFieldError({ ...untouched, isVisited: true, value: '' })).toBe(false);
  });

  it('shows everything after a failed submit', () => {
    expect(showsFieldError({ ...untouched, submitAttempts: 1, isFocused: true, value: '' })).toBe(true);
  });
});

describe('fieldProblem', () => {
  it('asks for all 11 digits of the personal number', () => {
    expect(fieldProblem('personalNumber', '0100101', display)).toBe('Enter all 11 digits of your personal number.');
    expect(fieldProblem('personalNumber', '01001012345', display)).toBeNull();
  });

  it('explains what is wrong with the phone number', () => {
    expect(fieldProblem('phoneNumber', '412', display)).toBe('Georgian mobile numbers start with 5.');
    expect(fieldProblem('phoneNumber', '5551', display)).toBe('Enter all 9 digits after +995.');
    expect(fieldProblem('phoneNumber', '555123456', display)).toBeNull();
  });
});

describe('firstInvalidField', () => {
  it('picks fields in form order', () => {
    expect(firstInvalidField({ personalNumber: '1', phoneNumber: '1' })).toBe('personalNumber');
    expect(firstInvalidField({ personalNumber: '01001012345', phoneNumber: '' })).toBe('phoneNumber');
    expect(firstInvalidField({ personalNumber: '01001012345', phoneNumber: '555123456' })).toBeNull();
  });
});
