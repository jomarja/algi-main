import { HeaderButton } from '../../design/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { PersonalInfoForm } from '../onboarding/PersonalInfoForm.tsx';
import { usePersonalInfoDraft } from '../onboarding/usePersonalInfoDraft.ts';

/** Edits the personal number and phone (PersonalInfoEditor in PersonalInfoView.swift); Save checks both first. */
export default function PersonalInfoEditorScreen(_props: ScreenProps) {
  const display = useDisplay();
  const router = useRouter();
  const draft = usePersonalInfoDraft();
  const save = () => draft.save(() => router.back('/settings'));

  return (
    <ScreenLayout
      title={display.t('Personal information', 'პირადი ინფორმაცია')}
      width="narrow"
      trailing={<HeaderButton title={display.t('Save', 'შენახვა')} isProminent onClick={save} />}
    >
      <PersonalInfoForm values={draft.values} onChange={draft.setValues} submitAttempts={draft.submitAttempts} onSubmit={save} />
    </ScreenLayout>
  );
}
