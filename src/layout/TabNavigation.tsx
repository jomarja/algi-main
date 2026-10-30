import type { ReactNode } from 'react';
import { cx } from '../design/cx.ts';
import { Icon } from '../design/Icon.tsx';
import { BrandMark } from '../design/Brand.tsx';
import { SAMPLE_PROFILE } from '../engine/sampleData.ts';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { Link, opensElsewhere, useIsActive } from './router/Link.tsx';
import { useCurrentRoute, useRouter } from './router/Router.tsx';
import { tabs } from './tabs.ts';
import type { TabDefinition } from './tabs.ts';

interface TabLinkProps {
  tab: TabDefinition;
  isActive: boolean;
  className: string;
  children: ReactNode;
}

/** A real link to the tab (new-tab clicks work) that, on a plain click, reopens the tab where the user left it. */
function TabLink({ tab, isActive, className, children }: TabLinkProps) {
  const { openTab } = useRouter();
  return (
    <Link
      to={tab.path}
      aria-current={isActive ? 'page' : undefined}
      className={className}
      onClick={(event) => {
        if (opensElsewhere(event)) return;
        event.preventDefault();
        openTab(tab);
      }}
    >
      {children}
    </Link>
  );
}

/** The phone tab bar (MainTabView): five tabs over the home indicator, ink when selected. */
export function TabBar() {
  const display = useDisplay();
  const activeTab = useCurrentRoute()?.tab ?? null;

  return (
    <nav
      aria-label={display.t('Main', 'მთავარი მენიუ')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-safe backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <ul className="mx-auto flex h-[var(--tab-bar-height)] max-w-lg px-safe">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <li key={tab.id} className="flex-1">
              <TabLink
                tab={tab}
                isActive={isActive}
                className={cx(
                  'flex h-full flex-col items-center justify-center gap-0.5 pt-1 transition-colors',
                  isActive ? 'text-ink' : 'text-inkMuted',
                )}
              >
                <Icon name={tab.icon} size={24} />
                <span className="text-[10px] font-medium leading-3">{display.text(tab.title)}</span>
              </TabLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Laptop navigation: brand, the five tabs, and the profile at the bottom. */
export function Sidebar() {
  const display = useDisplay();
  const activeTab = useCurrentRoute()?.tab ?? null;
  const isOnProfile = useIsActive('/settings');

  return (
    <nav
      aria-label={display.t('Main', 'მთავარი მენიუ')}
      className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-line bg-paper px-4 pb-5 pt-[calc(var(--safe-top)+24px)] md:flex"
    >
      <div className="px-3 pb-8">
        <BrandMark />
      </div>
      <ul className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <li key={tab.id}>
              <TabLink
                tab={tab}
                isActive={isActive}
                className={cx(
                  'type-body flex min-h-[44px] items-center gap-3 rounded-md px-3 font-semibold transition-colors',
                  isActive ? 'bg-mintPale text-ink' : 'text-inkSoft hover:bg-cream hover:text-ink',
                )}
              >
                <Icon name={tab.icon} size={22} />
                {display.text(tab.title)}
              </TabLink>
            </li>
          );
        })}
      </ul>
      <Link
        to="/settings"
        aria-current={isOnProfile ? 'page' : undefined}
        aria-label={display.t('Profile and settings', 'პროფილი და პარამეტრები')}
        className={cx(
          'mt-auto flex items-center gap-3 rounded-md p-2 transition-colors',
          isOnProfile ? 'bg-mintPale' : 'hover:bg-cream',
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink font-rounded text-[14px] font-extrabold text-white">
          {SAMPLE_PROFILE.initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="type-subheadline truncate font-semibold text-ink">{display.text(SAMPLE_PROFILE.fullName)}</span>
          <span className="type-footnote text-inkSoft">{display.t('Profile', 'პროფილი')}</span>
        </span>
      </Link>
    </nav>
  );
}
