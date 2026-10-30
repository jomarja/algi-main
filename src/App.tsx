import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { BankConsentReturn } from './api/bankConsent.ts';
import { ToastProvider, useToast } from './design/Toast.tsx';
import { AppShell } from './layout/AppShell.tsx';
import { RouteOutlet } from './layout/RouteOutlet.tsx';
import { accessRedirect } from './layout/router/access.ts';
import { RouterProvider, useRouter } from './layout/router/Router.tsx';
import { resolveRoutes } from './layout/router/routeTable.ts';
import { routes } from './routes.ts';
import { useAppStore, useDisplay } from './state/AppStateProvider.tsx';

const resolvedRoutes = resolveRoutes(routes);

interface AppProps {
  /** Set when the user just came back from TBC's consent page (see takeBankConsentReturn in main.tsx). */
  bankReturn: BankConsentReturn | null;
}

export function App({ bankReturn }: AppProps) {
  return (
    <ToastProvider>
      <RouterProvider routes={resolvedRoutes}>
        <DocumentLanguage />
        <BankReturnNotice bankReturn={bankReturn} />
        <OnboardingGate>
          <AppShell>
            <RouteOutlet />
          </AppShell>
        </OnboardingGate>
      </RouterProvider>
    </ToastProvider>
  );
}

/** Onboarding until it's complete, the app after (see accessRedirect). Renders nothing while a redirect is pending. */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { hasCompletedOnboarding } = useAppStore().getState();
  const { match, navigate } = useRouter();
  const redirect = accessRedirect(match?.route.access ?? 'app', hasCompletedOnboarding);

  useLayoutEffect(() => {
    if (redirect) navigate(redirect, { replace: true });
  }, [redirect, navigate]);

  return redirect ? null : <>{children}</>;
}

/** Keeps `<html lang>` in step with the app language, for screen readers, hyphenation and fonts. */
function DocumentLanguage() {
  const { language } = useDisplay();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}

/** After TBC's consent page, confirms the outcome in a toast. main.tsx has already started loading the bank data. */
function BankReturnNotice({ bankReturn }: { bankReturn: BankConsentReturn | null }) {
  const display = useDisplay();
  const toast = useToast();
  const isHandled = useRef(false);

  useEffect(() => {
    if (!bankReturn || isHandled.current) return;
    isHandled.current = true;

    if (bankReturn.outcome === 'connected') {
      toast.show({
        kind: 'success',
        title: display.t('TBC Bank connected', 'TBC ბანკი დაკავშირებულია'),
        message: display.t("We're loading your latest balances and transactions.", 'ვტვირთავთ შენს ბოლო ბალანსებსა და ტრანზაქციებს.'),
      });
      return;
    }

    toast.show({
      kind: 'error',
      title: display.t("Couldn't connect TBC Bank", 'TBC ბანკთან დაკავშირება ვერ მოხერხდა'),
      message: consentFailureMessage(bankReturn.reason, display.t),
      duration: 6000,
    });
  }, [bankReturn, display, toast]);

  return null;
}

function consentFailureMessage(reason: string | null, t: (en: string, ka: string) => string): string {
  switch (reason) {
    case 'access_denied':
      return t('You declined access at the bank, so nothing was shared.', 'ბანკში წვდომაზე უარი თქვი, ამიტომ არაფერი გაზიარებულა.');
    case 'session_expired':
      return t('The connection took too long. Please try again.', 'დაკავშირებას ძალიან დიდი დრო დასჭირდა. სცადე თავიდან.');
    default:
      return t(
        'Something went wrong on the way back from the bank. Please try again.',
        'ბანკიდან დაბრუნებისას რაღაც შეფერხდა. სცადე თავიდან.',
      );
  }
}
