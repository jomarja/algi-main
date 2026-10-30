import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { prefersReducedMotion } from '../../design/media.ts';
import type { TabDefinition, TabId } from '../tabs.ts';
import { createBrowserHistory } from './history.ts';
import type { AppLocation, NavigationAction } from './history.ts';
import { buildPath } from './matchPath.ts';
import type { RouteParams } from './matchPath.ts';
import { findRoute } from './routeTable.ts';
import type { ResolvedRoute, RouteMatch } from './routeTable.ts';
import { transitionBetween } from './transition.ts';
import type { RouteTransition, ShownScreen } from './transition.ts';

export interface NavigateOptions {
  replace?: boolean;
  /** Scroll position to restore on arrival instead of the top, e.g. a tab's last position. */
  scrollY?: number;
}

export interface RouterValue {
  location: AppLocation;
  action: NavigationAction;
  /** The screen for the current URL, or null when nothing matches. */
  match: RouteMatch | null;
  transition: RouteTransition;
  navigate(to: string, options?: NavigateOptions): void;
  /** Goes back in history while it stays inside the app; otherwise replaces the screen with `fallback` or the parent. */
  back(fallback?: string): void;
  /** Whether the screen shows Back: it sits below a tab root, or is presented over the tabs ('stack'). */
  canGoBack: boolean;
  /** Opens a tab where the user left it; on the tab already, returns to its root (or scrolls to the top). */
  openTab(tab: TabDefinition): void;
  /** Called by the route outlet once the new screen has rendered, to restore or reset the scroll position. */
  restoreScroll(): void;
}

interface TabMemory {
  path: string;
  scrollY: number;
}

const RouterContext = createContext<RouterValue | null>(null);

interface RouterProviderProps {
  routes: readonly ResolvedRoute[];
  children: ReactNode;
}

/** History-API router: matches the URL against the route table and tracks scroll per history entry. */
export function RouterProvider({ routes, children }: RouterProviderProps) {
  const [history] = useState(createBrowserHistory);
  const { location, action } = useSyncExternalStore(history.subscribe, history.getSnapshot);
  const match = useMemo(() => findRoute(routes, location.pathname), [routes, location.pathname]);

  const [scrollPositions] = useState(() => new Map<string, number>());
  const [tabMemory] = useState(() => new Map<TabId, TabMemory>());
  const shown = useRef<ShownScreen | null>(null);
  const pendingScrollY = useRef<number | null>(null);
  const departedPathname = useRef<string | null>(null);
  // Between a URL change and the new screen's first render, scroll events describe neither page.
  const isSettling = useRef(true);

  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    // Runs before React re-renders for a navigation, while the old page is still on screen.
    return history.subscribe(() => {
      if (shown.current) scrollPositions.set(shown.current.location.key, window.scrollY);
      departedPathname.current = shown.current?.location.pathname ?? null;
      isSettling.current = true;
    });
  }, [history, scrollPositions]);

  // `location` changes identity once per navigation, and `shown` still holds the screen being left.
  const transition = useMemo(
    () => transitionBetween(shown.current, { location, route: match?.route ?? null }, action),
    [location, match, action],
  );

  useEffect(() => {
    shown.current = { location, route: match?.route ?? null };
    const tab = match?.route.tab;
    if (!tab) return;
    const path = location.pathname + location.search;
    const remembered = tabMemory.get(tab);
    tabMemory.set(tab, { path, scrollY: remembered?.path === path ? remembered.scrollY : 0 });
  }, [location, match, tabMemory]);

  useEffect(() => {
    let frame = 0;
    const remember = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (isSettling.current) return;
        scrollPositions.set(location.key, window.scrollY);
        const tab = match?.route.tab;
        if (tab) tabMemory.set(tab, { path: location.pathname + location.search, scrollY: window.scrollY });
      });
    };
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', remember);
    };
  }, [location, match, scrollPositions, tabMemory]);

  const navigate = useCallback(
    (to: string, options: NavigateOptions = {}) => {
      pendingScrollY.current = options.scrollY ?? null;
      if (options.replace) history.replace(to);
      else history.push(to);
    },
    [history],
  );

  const restoreScroll = useCallback(() => {
    const requested = pendingScrollY.current;
    pendingScrollY.current = null;
    isSettling.current = false;
    // Replacing the query on the same screen (e.g. a filter) keeps the reader's place.
    if (action === 'replace' && requested === null && departedPathname.current === location.pathname) return;

    const anchor = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, action === 'pop' ? (scrollPositions.get(location.key) ?? 0) : (requested ?? 0));
  }, [action, location, scrollPositions]);

  const parentPath = match?.route.parent ? buildPath(match.route.parent.pattern, match.params) : null;

  const back = useCallback(
    (fallback?: string) => {
      if (location.index > 0) history.back();
      else navigate(fallback ?? parentPath ?? '/', { replace: true });
    },
    [history, location.index, navigate, parentPath],
  );

  const openTab = useCallback(
    (tab: TabDefinition) => {
      if (match?.route.tab !== tab.id) {
        const memory = tabMemory.get(tab.id);
        navigate(memory?.path ?? tab.path, { scrollY: memory?.scrollY });
      } else if (location.pathname !== tab.path) {
        navigate(tab.path);
      } else {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    },
    [location.pathname, match, navigate, tabMemory],
  );

  const value = useMemo<RouterValue>(
    () => ({
      location,
      action,
      match,
      transition,
      navigate,
      back,
      canGoBack: parentPath !== null || match?.route.chrome === 'stack',
      openTab,
      restoreScroll,
    }),
    [location, action, match, transition, navigate, back, parentPath, openTab, restoreScroll],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const router = useContext(RouterContext);
  if (!router) throw new Error('useRouter must be used inside <RouterProvider>');
  return router;
}

/** The current screen's route params, e.g. `{ goalId }` on '/goals/:goalId'. */
export function useParams(): RouteParams {
  return useRouter().match?.params ?? {};
}

/** The current route, or null on an unknown URL. */
export function useCurrentRoute(): ResolvedRoute | null {
  return useRouter().match?.route ?? null;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useRouter().location;
  return useMemo(() => new URLSearchParams(search), [search]);
}
