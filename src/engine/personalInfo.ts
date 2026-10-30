import type { Display } from './display.ts';

/** The account owner's identity details. Kept in memory only, never persisted. */
export interface PersonalInfo {
  /** 11-digit Georgian personal number (პირადი ნომერი). */
  readonly personalNumber: string;
  /** 9-digit national mobile number, without the +995 country code. */
  readonly phoneNumber: string;
}

const PERSONAL_NUMBER_LENGTH = 11;
const PHONE_NUMBER_LENGTH = 9;
const NON_DIGITS = /[^0-9]/g;
const ONLY_DIGITS = /^[0-9]*$/;

function digitsOnly(text: string): string {
  return text.replace(NON_DIGITS, '');
}

/** Georgian personal number: exactly 11 digits. */
export const PersonalNumber = {
  length: PERSONAL_NUMBER_LENGTH,

  /** What the field keeps while typing: digits only, at most 11. */
  sanitized(text: string): string {
    return digitsOnly(text).slice(0, PERSONAL_NUMBER_LENGTH);
  },

  isValid(number: string): boolean {
    return number.length === PERSONAL_NUMBER_LENGTH && ONLY_DIGITS.test(number);
  },

  /** Shows only the last four digits, e.g. "•••••••7890". */
  masked(number: string): string {
    return '•'.repeat(Math.max(number.length - 4, 0)) + number.slice(-4);
  },
} as const;

export type PhoneNumberProblem = 'notMobile' | 'incomplete';

/** Georgian mobile number: +995, then 9 digits starting with 5. */
export const GeorgianPhoneNumber = {
  countryCode: '+995',
  length: PHONE_NUMBER_LENGTH,

  /** What the field keeps while typing: digits only, at most 9. A pasted or autofilled +995 is dropped. */
  sanitized(text: string): string {
    const digits = digitsOnly(text);
    const national = digits.length > PHONE_NUMBER_LENGTH && digits.startsWith('995') ? digits.slice(3) : digits;
    return national.slice(0, PHONE_NUMBER_LENGTH);
  },

  problem(digits: string): PhoneNumberProblem | null {
    if (digits.length > 0 && (!digits.startsWith('5') || !ONLY_DIGITS.test(digits))) return 'notMobile';
    return digits.length === PHONE_NUMBER_LENGTH ? null : 'incomplete';
  },

  /** Groups digits as they're typed: "555 12 34 56". */
  formatted(digits: string): string {
    const groups: string[] = [];
    let remaining = digits;
    for (const size of [3, 2, 2, 2]) {
      if (!remaining) break;
      groups.push(remaining.slice(0, size));
      remaining = remaining.slice(size);
    }
    return groups.join(' ');
  },
} as const;

/** Builds the details from field values, or null if either one isn't valid. */
export function validatedPersonalInfo(personalNumber: string, phoneNumber: string): PersonalInfo | null {
  if (!PersonalNumber.isValid(personalNumber) || GeorgianPhoneNumber.problem(phoneNumber) !== null) return null;
  return { personalNumber, phoneNumber };
}

export function personalNumberError(display: Display): string {
  return display.t('Enter all 11 digits of your personal number.', 'შეიყვანე პირადი ნომრის 11-ვე ციფრი.');
}

export function phoneNumberError(problem: PhoneNumberProblem, display: Display): string {
  switch (problem) {
    case 'notMobile':
      return display.t('Georgian mobile numbers start with 5.', 'ქართული მობილურის ნომერი 5-ით იწყება.');
    case 'incomplete':
      return display.t('Enter all 9 digits after +995.', 'შეიყვანე +995-ის შემდეგ 9-ვე ციფრი.');
  }
}
