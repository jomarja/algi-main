import { useState } from 'react';
import { validatedPersonalInfo } from '../../engine/index.ts';
import { useAppStore } from '../../state/AppStateProvider.tsx';
import type { PersonalInfoValues } from './personalInfoFormModel.ts';

export interface PersonalInfoDraft {
  values: PersonalInfoValues;
  setValues: (values: PersonalInfoValues) => void;
  submitAttempts: number;
  /** Saves valid details and calls `onSaved`; otherwise counts a failed attempt so the form shows its errors. */
  save: (onSaved: () => void) => void;
}

/** The personal-information fields being edited, starting from what's saved (onboarding step and Settings editor). */
export function usePersonalInfoDraft(): PersonalInfoDraft {
  const store = useAppStore();
  const [values, setValues] = useState<PersonalInfoValues>(() => {
    const saved = store.getState().personalInfo;
    return { personalNumber: saved?.personalNumber ?? '', phoneNumber: saved?.phoneNumber ?? '' };
  });
  const [submitAttempts, setSubmitAttempts] = useState(0);

  const save = (onSaved: () => void) => {
    const info = validatedPersonalInfo(values.personalNumber, values.phoneNumber);
    if (!info) {
      setSubmitAttempts((attempts) => attempts + 1);
      return;
    }
    store.setPersonalInfo(info);
    onSaved();
  };

  return { values, setValues, submitAttempts, save };
}
