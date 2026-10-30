import type { AppLocation, NavigationAction } from './history.ts';
import type { ResolvedRoute } from './routeTable.ts';

/** How the incoming screen animates in: iOS push/pop slides within a tab, a cross-fade between tabs. */
export type RouteTransition = 'none' | 'push' | 'pop' | 'fade';

export interface ShownScreen {
  location: AppLocation;
  route: ResolvedRoute | null;
}

export function transitionBetween(
  previous: ShownScreen | null,
  next: ShownScreen,
  action: NavigationAction,
): RouteTransition {
  if (!previous || action === 'initial') return 'none';
  if (action === 'replace') return 'fade';

  const from = previous.route;
  const to = next.route;
  if (!from || !to || from.tab !== to.tab || from.chrome !== to.chrome) return 'fade';

  if (action === 'pop') return next.location.index < previous.location.index ? 'pop' : 'push';
  if (to.depth > from.depth) return 'push';
  if (to.depth < from.depth) return 'pop';
  return 'fade';
}
