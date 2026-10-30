import { Suspense, useEffect, useLayoutEffect } from 'react';
import { ScreenSkeleton } from '../design/Skeleton.tsx';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { NotFoundScreen } from './NotFoundScreen.tsx';
import { useRouter } from './router/Router.tsx';
import type { RouteTransition } from './router/transition.ts';

export const mainContentId = 'main';

const transitionClasses: Record<RouteTransition, string> = {
  none: '',
  push: 'animate-page-push',
  pop: 'animate-page-pop',
  fade: 'animate-page-fade',
};

/**
 * Renders the current route's screen, lazily loaded, with an iOS-style entrance (slide on push/pop, fade between
 * tabs). Query-only changes keep the screen mounted.
 */
export function RouteOutlet() {
  const { match, location, transition } = useRouter();
  const display = useDisplay();
  const title = match ? display.text(match.route.title) : display.t('Not found', 'ვერ მოიძებნა');

  useEffect(() => {
    document.title = `${title} · Algi`;
  }, [title]);

  const Screen = match?.route.Screen;

  return (
    <div key={location.pathname} className={transitionClasses[transition]}>
      <Suspense fallback={<ScreenSkeleton />}>
        {match && Screen ? <Screen params={match.params} route={match.route} /> : <NotFoundScreen />}
        <ScreenReady />
      </Suspense>
    </div>
  );
}

/**
 * Sits after the screen in the same Suspense boundary, so it commits only once the screen's code has loaded:
 * then it restores the scroll position and moves focus to the new page for keyboard and screen-reader users.
 */
function ScreenReady() {
  const { action, restoreScroll } = useRouter();

  useLayoutEffect(() => {
    restoreScroll();
    if (action !== 'initial') document.getElementById(mainContentId)?.focus({ preventScroll: true });
  }, [action, restoreScroll]);

  return null;
}
