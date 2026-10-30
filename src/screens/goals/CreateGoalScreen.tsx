import { useMemo, useState } from 'react';
import { HeaderButton } from '../../design/index.ts';
import { goalFromDraft } from '../../engine/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { GoalForm } from './GoalForm.tsx';
import { newGoalDraft } from './goalDraft.ts';
import { journeyTabPath } from './goalRoutes.ts';

/** A new goal set up by hand (CreateGoalSheet.swift), presented over the tabs. Creating it opens its journey. */
export default function CreateGoalScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const [fields, setFields] = useState(() => newGoalDraft(store.now, store.getState().savingsTarget));
  const draft = useMemo(() => goalFromDraft(fields), [fields]);

  const create = () => {
    if (!draft) return;
    store.addGoal(draft);
    router.navigate(journeyTabPath(draft.id), { replace: true });
  };

  return (
    <ScreenLayout
      title={display.t('New goal', 'ახალი მიზანი')}
      width="narrow"
      leading={<HeaderButton title={display.t('Cancel', 'გაუქმება')} onClick={() => router.back('/journey')} />}
      trailing={<HeaderButton title={display.t('Create', 'შექმნა')} isProminent disabled={!draft} onClick={create} />}
    >
      <GoalForm fields={fields} onChange={setFields} draft={draft} now={store.now} />
    </ScreenLayout>
  );
}
