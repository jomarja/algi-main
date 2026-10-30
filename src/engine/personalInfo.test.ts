import { describe, expect, it } from 'vitest';
import { createDisplay } from './display.ts';
import { GeorgianPhoneNumber, PersonalNumber, phoneNumberError, validatedPersonalInfo } from './personalInfo.ts';

describe('Personal information', () => {
  it('personal number keeps only eleven digits', () => {
    expect(PersonalNumber.sanitized('010 2345-6789')).toBe('01023456789');
    expect(PersonalNumber.sanitized('0102345678912345')).toBe('01023456789');
    expect(PersonalNumber.sanitized('abc')).toBe('');
  });

  it('ignores digits from other scripts', () => {
    expect(PersonalNumber.sanitized('٠١٢٣')).toBe('');
  });

  it('personal number needs exactly eleven digits', () => {
    expect(PersonalNumber.isValid('01023456789')).toBe(true);
    expect(PersonalNumber.isValid('0102345678')).toBe(false);
    expect(PersonalNumber.isValid('0102345678a')).toBe(false);
  });

  it('masks all but the last four digits', () => {
    expect(PersonalNumber.masked('01023456789')).toBe('•••••••6789');
    expect(PersonalNumber.masked('123')).toBe('123');
  });

  it('phone keeps nine digits and drops the country code', () => {
    expect(GeorgianPhoneNumber.sanitized('555 12 34 56')).toBe('555123456');
    expect(GeorgianPhoneNumber.sanitized('+995 555 12 34 56')).toBe('555123456');
    expect(GeorgianPhoneNumber.sanitized('555 12 34 567')).toBe('555123456');
  });

  it.each([
    ['', ''],
    ['5', '5'],
    ['5551', '555 1'],
    ['555123', '555 12 3'],
    ['555123456', '555 12 34 56'],
  ])('groups phone digits "%s" as they are typed', (digits, expected) => {
    expect(GeorgianPhoneNumber.formatted(digits)).toBe(expected);
  });

  it('explains what is wrong with a phone number', () => {
    expect(GeorgianPhoneNumber.problem('')).toBe('incomplete');
    expect(GeorgianPhoneNumber.problem('5551234')).toBe('incomplete');
    expect(GeorgianPhoneNumber.problem('322123456')).toBe('notMobile');
    expect(GeorgianPhoneNumber.problem('55512345a')).toBe('notMobile');
    expect(GeorgianPhoneNumber.problem('555123456')).toBeNull();
    expect(phoneNumberError('notMobile', createDisplay('en'))).toBe('Georgian mobile numbers start with 5.');
  });

  it('accepts an autofilled phone number', () => {
    expect(GeorgianPhoneNumber.problem(GeorgianPhoneNumber.sanitized('+995 599 98 76 54'))).toBeNull();
  });

  it('builds details only when both fields are valid', () => {
    expect(validatedPersonalInfo('01023456789', '555123456')).toEqual({ personalNumber: '01023456789', phoneNumber: '555123456' });
    expect(validatedPersonalInfo('0102345678', '555123456')).toBeNull();
    expect(validatedPersonalInfo('01023456789', '322123456')).toBeNull();
  });
});
