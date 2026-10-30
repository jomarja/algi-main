import { findRoute, resolveRoutes } from './layout/router/routeTable.ts';
import { tabs } from './layout/tabs.ts';
import { routes } from './routes.ts';

const resolved = resolveRoutes(routes);

describe('route table', () => {
  it('has no two screens on the same path', () => {
    const patterns = resolved.map((route) => route.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('gives every tab a root screen that belongs to it', () => {
    for (const tab of tabs) {
      expect(findRoute(resolved, tab.path)?.route).toMatchObject({ pattern: tab.path, tab: tab.id, chrome: 'tabs' });
    }
  });

  it('lists every screen of the iOS app', () => {
    const expected = [
      '/welcome',
      '/onboarding/personalization',
      '/onboarding/personal-info',
      '/onboarding/bank',
      '/',
      '/transactions',
      '/transactions/new',
      '/transactions/:transactionId',
      '/journey',
      '/journey/:goalId',
      '/goals/new',
      '/goals/:goalId',
      '/coach',
      '/coach/recommendations',
      '/coach/recommendations/:recommendationId',
      '/plan',
      '/plan/goal-planner',
      '/plan/what-if',
      '/plan/saved-plans',
      '/plan/loans',
      '/plan/budget',
      '/insights',
      '/insights/:insightId',
      '/settings',
      '/settings/personal-info',
      '/settings/permissions',
      '/settings/design-system',
      '/paywall',
    ];
    expect(resolved.map((route) => route.pattern).sort()).toEqual([...expected].sort());
  });

  it('keeps onboarding free of navigation chrome and behind the onboarding gate', () => {
    for (const path of ['/welcome', '/onboarding/personalization', '/onboarding/personal-info', '/onboarding/bank']) {
      expect(findRoute(resolved, path)?.route).toMatchObject({ chrome: 'bare', access: 'onboarding' });
    }
  });

  it('presents forms, settings and the paywall over the tabs', () => {
    for (const path of ['/transactions/new', '/goals/new', '/settings', '/settings/permissions', '/paywall']) {
      expect(findRoute(resolved, path)?.route.chrome).toBe('stack');
    }
  });

  it('resolves detail paths with their params', () => {
    expect(findRoute(resolved, '/goals/new')?.route.pattern).toBe('/goals/new');
    expect(findRoute(resolved, '/goals/car')?.params).toEqual({ goalId: 'car' });
    expect(findRoute(resolved, '/insights/deliveryIncrease')?.params).toEqual({ insightId: 'deliveryIncrease' });
  });

  it('sends Back from a goal to the Journey tab', () => {
    expect(findRoute(resolved, '/goals/car')?.route.parent?.pattern).toBe('/journey');
  });

  it('keeps the design system gallery reachable at any time', () => {
    expect(findRoute(resolved, '/settings/design-system')?.route.access).toBe('any');
  });

  it('titles every screen in both languages', () => {
    for (const route of resolved) {
      expect(route.title.en.length).toBeGreaterThan(0);
      expect(route.title.ka.length).toBeGreaterThan(0);
    }
  });
});
