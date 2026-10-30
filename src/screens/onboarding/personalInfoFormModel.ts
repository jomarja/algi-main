import {
  GeorgianPhoneNumber,
  PersonalNumber,
  personalNumberError,
  phoneNumberError,
  type Display,
} from '../../engine/index.ts';

export type PersonalInfoField = 'personalNumber' | 'phoneNumber';

export const PERSONAL_INFO_FIELDS: readonly PersonalInfoField[] = ['personalNumber', 'phoneNumber'];

export type PersonalInfoValues = Readonly<Record<PersonalInfoField, string>>;

export interface FieldErrorTiming {
  /** Failed submits so far; after the first, every error shows. */
  readonly submitAttempts: number;
  /** The field has been focused and left at least once. */
  readonly isVisited: boolean;
  readonly isFocused: boolean;
  readonly value: string;
}

/** No nagging while typing or before a field has been touched (PersonalInfoForm.shouldShowError). */
export function showsFieldError({ submitAttempts, isVisited, isFocused, value }: FieldErrorTiming): boolean {
  if (submitAttempts > 0) return true;
  return isVisited && !isFocused && value !== '';
}

/** What's wrong with a field's current value, whether or not it's time to show it. */
export function fieldProblem(field: PersonalInfoField, value: string, display: Display): string | null {
  if (field === 'personalNumber') return PersonalNumber.isValid(value) ? null : personalNumberError(display);
  const problem = GeorgianPhoneNumber.problem(value);
  return problem ? phoneNumberError(problem, display) : null;
}

function isValid(field: PersonalInfoField, value: string): boolean {
  return field === 'personalNumber' ? PersonalNumber.isValid(value) : GeorgianPhoneNumber.problem(value) === null;
}

/** Where focus goes after a failed submit. */
export function firstInvalidField(values: PersonalInfoValues): PersonalInfoField | null {
  return PERSONAL_INFO_FIELDS.find((field) => !isValid(field, values[field])) ?? null;
}
