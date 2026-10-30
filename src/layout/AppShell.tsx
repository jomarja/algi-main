import type { ReactNode } from 'react';
import { cx } from '../design/cx.ts';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { useCurrentRoute } from './router/Router.tsx';
import { mainContentId } from './RouteOutlet.tsx';
import { Sidebar, TabBar } from './TabNavigation.tsx';

/**
 * The responsive frame. Phones (<768px): full-width content over a bottom tab bar, like the iOS app.
 * Laptops (≥768px): a sticky sidebar on the left and the content beside it. The route's `chrome` decides what shows:
 * 'tabs' everything, 'stack' no phone tab bar, 'bare' (onboarding) no navigation at all.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const display = useDisplay();
  const chrome = useCurrentRoute()?.chrome ?? 'tabs';

  return (
    <div className="min-h-dvh bg-paper md:flex">
      <button
        type="button"
        onClick={() => document.getElementById(mainContentId)?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        {display.t('Skip to content', 'კონტენტზე გადასვლა')}
      </button>
      {chrome !== 'bare' && <Sidebar />}
      <main
        id={mainContentId}
        tabIndex={-1}
        className={cx('min-w-0 flex-1 outline-none', chrome === 'tabs' && 'pb-tab-bar md:pb-0')}
      >
        {children}
      </main>
      {chrome === 'tabs' && <TabBar />}
    </div>
  );
}
