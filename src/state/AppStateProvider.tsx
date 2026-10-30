import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createDisplay, type Display } from '../engine/index.ts';
import type { AppStore } from './appStore.ts';

export { createAppStore } from './appStore.ts';

const AppStoreContext = createContext<AppStore | null>(null);

export interface AppStateProviderProps {
  readonly store: AppStore;
  readonly children: ReactNode;
}

export function AppStateProvider({ store, children }: AppStateProviderProps) {
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

function useStoreContext(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside <AppStateProvider>.');
  return store;
}

/** The app store; the calling component re-renders whenever the store's state changes. */
export function useAppStore(): AppStore {
  const store = useStoreContext();
  useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return store;
}

/**
 * Copy, money and date formatting in the user's language and display currency. Re-renders only when one of
 * those two changes, so formatting-only components (rows, mascots, labels) don't redraw on every store update.
 */
export function useDisplay(): Display {
  const store = useStoreContext();
  const settings = useSyncExternalStore(store.subscribe, () => displaySettingsKey(store), () => displaySettingsKey(store));
  return useMemo(() => {
    const [language, currency] = settings.split('|') as [Display['language'], Display['currency']];
    return createDisplay(language, currency, store.converter);
  }, [settings, store]);
}

function displaySettingsKey(store: AppStore): string {
  const { language, displayCurrency } = store.getState();
  return `${language}|${displayCurrency}`;
}
