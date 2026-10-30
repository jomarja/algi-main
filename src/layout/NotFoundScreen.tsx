import { ButtonLink } from '../design/Button.tsx';
import { EmptyState } from '../design/EmptyState.tsx';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { ScreenLayout } from './ScreenLayout.tsx';

/** Shown for a URL that matches no route. */
export function NotFoundScreen() {
  const display = useDisplay();
  const title = display.t('Nothing here', 'აქ არაფერია');
  return (
    <ScreenLayout title={title} back="/">
      <EmptyState
        title={title}
        message={display.t("This page doesn't exist. Let's get you back home.", 'ეს გვერდი არ არსებობს. დავბრუნდეთ მთავარზე.')}
      >
        <ButtonLink to="/">{display.t('Go home', 'მთავარზე დაბრუნება')}</ButtonLink>
      </EmptyState>
    </ScreenLayout>
  );
}
