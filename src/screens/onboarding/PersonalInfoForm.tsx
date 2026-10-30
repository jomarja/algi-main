import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Icon, TextField } from '../../design/index.ts';
import { GeorgianPhoneNumber, PersonalNumber } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { FloatingCard } from './FloatingCard.tsx';
import { fieldProblem, firstInvalidField, PERSONAL_INFO_FIELDS, showsFieldError } from './personalInfoFormModel.ts';
import type { PersonalInfoField, PersonalInfoValues } from './personalInfoFormModel.ts';

type PerField<Value> = Record<PersonalInfoField, Value>;

const noCounts: PerField<number> = { personalNumber: 0, phoneNumber: 0 };

interface PersonalInfoFormProps {
  values: PersonalInfoValues;
  onChange: (values: PersonalInfoValues) => void;
  /** Each failed submit shows every error, shakes the fields that have one, and moves focus to the first. */
  submitAttempts: number;
  /** Enter in the last field. */
  onSubmit: () => void;
  /** Puts each field on its own bobbing card, for the coin-sea background. */
  floatsOnCoins?: boolean;
}

/**
 * Personal number and mobile number with inline validation (PersonalInfoForm in PersonalInfoView.swift).
 * A field's error shows once you leave it, or on submit. Focusing a floating field makes its card hop.
 */
export function PersonalInfoForm({ values, onChange, submitAttempts, onSubmit, floatsOnCoins = false }: PersonalInfoFormProps) {
  const display = useDisplay();
  const [focusedField, setFocusedField] = useState<PersonalInfoField | null>(null);
  const [visitedFields, setVisitedFields] = useState<ReadonlySet<PersonalInfoField>>(() => new Set());
  const [focusCounts, setFocusCounts] = useState(noCounts);
  const [shakeCounts, setShakeCounts] = useState(noCounts);
  const inputs = useRef<PerField<HTMLInputElement | null>>({ personalNumber: null, phoneNumber: null });
  const handledAttempts = useRef(submitAttempts);

  useEffect(() => {
    if (submitAttempts === handledAttempts.current) return;
    handledAttempts.current = submitAttempts;
    const invalid = PERSONAL_INFO_FIELDS.filter((field) => fieldProblem(field, values[field], display) !== null);
    setShakeCounts((counts) => ({
      personalNumber: counts.personalNumber + (invalid.includes('personalNumber') ? 1 : 0),
      phoneNumber: counts.phoneNumber + (invalid.includes('phoneNumber') ? 1 : 0),
    }));
    const first = firstInvalidField(values);
    if (first) inputs.current[first]?.focus();
  }, [submitAttempts, values, display]);

  const errorFor = (field: PersonalInfoField): string | undefined => {
    const value = values[field];
    const isShown = showsFieldError({
      submitAttempts,
      isVisited: visitedFields.has(field),
      isFocused: focusedField === field,
      value,
    });
    return (isShown && fieldProblem(field, value, display)) || undefined;
  };

  const fieldEvents = (field: PersonalInfoField) => ({
    ref: (element: HTMLInputElement | null) => {
      inputs.current[field] = element;
    },
    onFocus: () => {
      setFocusedField(field);
      setFocusCounts((counts) => ({ ...counts, [field]: counts[field] + 1 }));
    },
    onBlur: () => {
      setFocusedField(null);
      setVisitedFields((visited) => new Set(visited).add(field));
    },
  });

  const handlePersonalNumberKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    inputs.current.phoneNumber?.focus();
  };

  const handlePhoneNumberKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="flex flex-col gap-4">
      <FloatingCard
        index={1}
        hopTrigger={focusCounts.personalNumber}
        shakeTrigger={shakeCounts.personalNumber}
        isActive={floatsOnCoins}
      >
        <TextField
          {...fieldEvents('personalNumber')}
          label={display.t('Personal number', 'პირადი ნომერი')}
          name="personal-number"
          value={values.personalNumber}
          onChange={(event) => onChange({ ...values, personalNumber: PersonalNumber.sanitized(event.target.value) })}
          onKeyDown={handlePersonalNumberKey}
          placeholder={display.t('11 digits', '11 ციფრი')}
          inputMode="numeric"
          enterKeyHint="next"
          autoComplete="off"
          spellCheck={false}
          error={errorFor('personalNumber')}
        />
      </FloatingCard>

      <FloatingCard index={2} hopTrigger={focusCounts.phoneNumber} shakeTrigger={shakeCounts.phoneNumber} isActive={floatsOnCoins}>
        <TextField
          {...fieldEvents('phoneNumber')}
          label={display.t('Mobile number', 'მობილურის ნომერი')}
          name="phone"
          prefix={GeorgianPhoneNumber.countryCode}
          value={GeorgianPhoneNumber.formatted(values.phoneNumber)}
          onChange={(event) => onChange({ ...values, phoneNumber: GeorgianPhoneNumber.sanitized(event.target.value) })}
          onKeyDown={handlePhoneNumberKey}
          placeholder="5XX XX XX XX"
          type="tel"
          inputMode="tel"
          enterKeyHint="done"
          autoComplete="tel-national"
          error={errorFor('phoneNumber')}
        />
      </FloatingCard>

      <FloatingCard index={3} isActive={floatsOnCoins}>
        <PrivacyNote />
      </FloatingCard>
    </div>
  );
}

function PrivacyNote() {
  const display = useDisplay();
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-mintPale text-mintDark">
        <Icon name="lock.fill" size={14} />
      </span>
      <p className="type-footnote text-inkSoft">
        {display.t(
          "Used only to confirm it's you when you connect a bank. In this prototype, nothing leaves your device.",
          'გამოიყენება მხოლოდ ბანკის დაკავშირებისას შენი ვინაობის დასადასტურებლად. ამ პროტოტიპში არაფერი ტოვებს შენს მოწყობილობას.',
        )}
      </p>
    </div>
  );
}
