import { BrandMark, Button, LanguageSwitcher, LukaAnimation, Overline } from '../../design/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';

/**
 * The first screen (WelcomeView): brand and language, Luka waving, the promise, and the way in.
 * Phones stack it like iOS; laptops put Luka beside the copy.
 */
export default function WelcomeScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const { navigate } = useRouter();

  const enterApp = () => {
    store.completeOnboarding();
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pt-safe md:max-w-[1040px] md:justify-center md:px-8">
      <div className="flex items-center justify-between gap-3 px-5 py-3 md:px-0">
        <BrandMark />
        <LanguageSwitcher value={store.getState().language} onChange={(language) => store.setLanguage(language)} className="w-[190px]" />
      </div>

      <div className="flex flex-1 flex-col md:flex-none md:grid md:grid-cols-2 md:items-center md:gap-12 md:py-8">
        <div className="relative h-[330px] overflow-hidden md:h-auto md:rounded-xl">
          <LukaAnimation clip="welcome" className="h-full w-full md:aspect-[4/3] md:h-auto" />
          {/* The paper hill Luka stands behind on phones. */}
          <span aria-hidden className="absolute -bottom-[5px] left-0 right-0 h-[70px] translate-y-1/2 rounded-[50%] bg-paper md:hidden" />
        </div>

        <div className="flex flex-1 flex-col md:flex-none">
          <div className="flex flex-col gap-3 px-5 pt-4 md:px-0 md:pt-0">
            <Overline>{display.t('Your money, made clear', 'შენი ფული, გასაგებად')}</Overline>
            <h1 className="type-display text-ink">{display.t('Make your money work for you.', 'ფულმა შენთვის იმუშაოს.')}</h1>
            <p className="type-body text-inkSoft">
              {display.t(
                'Understand your habits, spend with confidence, and build a better financial future.',
                'გაიგე შენი ჩვევები, ხარჯე თავდაჯერებულად და შექმენი უკეთესი ფინანსური მომავალი.',
              )}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-2 px-5 pb-[calc(12px+var(--safe-bottom))] pt-4 md:mt-8 md:px-0">
            <Button trailingIcon="arrow.right" onClick={() => navigate('/onboarding/personalization')}>
              {display.t('Get started', 'დაწყება')}
            </Button>
            <Button kind="tertiary" className="self-center" onClick={enterApp}>
              {display.t('I already have an account', 'უკვე მაქვს ანგარიში')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
