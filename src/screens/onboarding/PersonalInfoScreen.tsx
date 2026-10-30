import { Button, LukaAnimation } from '../../design/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { FloatingCard } from './FloatingCard.tsx';
import { OnboardingLayout, OnboardingTopBar, StepHeader } from './OnboardingChrome.tsx';
import { PersonalInfoForm } from './PersonalInfoForm.tsx';
import { usePersonalInfoDraft } from './usePersonalInfoDraft.ts';

/**
 * Step 2 of 3: personal number and phone, so a bank connection can confirm it's you. Optional.
 * The fields float on a sea of coins while Luka swims underneath (PersonalInfoView).
 */
export default function PersonalInfoScreen() {
  const display = useDisplay();
  const router = useRouter();
  const draft = usePersonalInfoDraft();
  const goToBank = () => router.navigate('/onboarding/bank');

  return (
    <>
      {/* The coin sea fills the phone screen; on laptops it fills the step's column, full height. */}
      <div className="fixed inset-y-0 left-1/2 w-full max-w-[480px] -translate-x-1/2">
        {/* Luka peeks in from the clip's right edge, so keep that edge when a tall screen crops it. */}
        <LukaAnimation clip="coinSwim" alignment="trailing" className="h-full w-full" />
      </div>

      <OnboardingLayout
        floating
        contentClassName="pt-[170px]"
        topBar={<OnboardingTopBar step={2} floating onBack={() => router.back('/onboarding/personalization')} />}
        actions={
          <>
            <Button trailingIcon="arrow.right" onClick={() => draft.save(goToBank)}>
              {display.t('Continue', 'გაგრძელება')}
            </Button>
            <Button kind="tertiary" className="self-center" onClick={goToBank}>
              {display.t('Skip for now', 'ახლა გამოტოვება')}
            </Button>
          </>
        }
      >
        <FloatingCard index={0}>
          <StepHeader
            overline={display.t('About you', 'შენ შესახებ')}
            title={display.t("Let's make sure it's you.", 'დავრწმუნდეთ, რომ ეს შენ ხარ.')}
            message={display.t(
              'Banks ask for these to confirm your identity when you connect an account.',
              'ბანკები ამას ანგარიშის დაკავშირებისას შენი ვინაობის დასადასტურებლად ითხოვენ.',
            )}
          />
        </FloatingCard>
        <PersonalInfoForm
          values={draft.values}
          onChange={draft.setValues}
          submitAttempts={draft.submitAttempts}
          onSubmit={() => draft.save(goToBank)}
          floatsOnCoins
        />
      </OnboardingLayout>
    </>
  );
}
