import { lt } from '../../engine/localization.ts';
import { findRoute, resolveRoutes } from './routeTable.ts';
import type { RouteConfig, ScreenLoader } from './routeTable.ts';

const screen: ScreenLoader = () => Promise.resolve({ default: () => null });

const table: readonly RouteConfig[] = [
  { path: 'welcome', title: lt('Welcome', 'მისალმება'), screen, chrome: 'bare', access: 'onboarding' },
  {
    path: '',
    title: lt('Home', 'მთავარი'),
    screen,
    tab: 'home',
    children: [
      {
        path: 'transactions',
        title: lt('Transactions', 'ტრანზაქციები'),
        screen,
        children: [
          { path: ':transactionId', title: lt('Transaction', 'ტრანზაქცია'), screen },
          { path: 'new', title: lt('Add', 'დამატება'), screen, chrome: 'stack' },
        ],
      },
    ],
  },
  {
    path: 'journey',
    title: lt('Journey', 'გზა'),
    screen,
    tab: 'journey',
    children: [{ path: '/goals/:goalId', title: lt('Goal', 'მიზანი'), screen }],
  },
  {
    path: 'group',
    title: lt('Group', 'ჯგუფი'),
    tab: 'plan',
    children: [{ path: 'child', title: lt('Child', 'შვილი'), screen }],
  },
];

const routes = resolveRoutes(table);

function route(pattern: string) {
  const found = routes.find((candidate) => candidate.pattern === pattern);
  if (!found) throw new Error(`No route ${pattern}`);
  return found;
}

describe('resolveRoutes', () => {
  it('builds absolute patterns from nested paths', () => {
    expect(routes.map((candidate) => candidate.pattern).sort()).toEqual(
      [
        '/',
        '/goals/:goalId',
        '/group/child',
        '/journey',
        '/transactions',
        '/transactions/:transactionId',
        '/transactions/new',
        '/welcome',
      ].sort(),
    );
  });

  it('puts static routes ahead of dynamic ones', () => {
    const patterns = routes.map((candidate) => candidate.pattern);
    expect(patterns.indexOf('/transactions/new')).toBeLessThan(patterns.indexOf('/transactions/:transactionId'));
  });

  it('inherits tab, chrome and access from the parent', () => {
    expect(route('/transactions/:transactionId')).toMatchObject({ tab: 'home', chrome: 'tabs', access: 'app' });
  });

  it('lets a child override an inherited setting', () => {
    expect(route('/transactions/new').chrome).toBe('stack');
  });

  it('applies the defaults at the top level', () => {
    expect(route('/welcome')).toMatchObject({ tab: null, chrome: 'bare', access: 'onboarding' });
  });

  it('links each route to the nearest ancestor with a screen and counts depth', () => {
    const detail = route('/transactions/:transactionId');
    expect(detail.parent?.pattern).toBe('/transactions');
    expect(detail.parent?.parent?.pattern).toBe('/');
    expect(detail.depth).toBe(2);
  });

  it('keeps an absolute child under its parent', () => {
    const goal = route('/goals/:goalId');
    expect(goal.parent?.pattern).toBe('/journey');
    expect(goal.tab).toBe('journey');
    expect(goal.depth).toBe(1);
  });

  it('passes settings through a grouping node without making it a route', () => {
    expect(routes.some((candidate) => candidate.pattern === '/group')).toBe(false);
    expect(route('/group/child')).toMatchObject({ tab: 'plan', parent: null, depth: 0 });
  });
});

describe('findRoute', () => {
  it('returns the matching route and its params', () => {
    const match = findRoute(routes, '/transactions/tx-1');
    expect(match?.route.pattern).toBe('/transactions/:transactionId');
    expect(match?.params).toEqual({ transactionId: 'tx-1' });
  });

  it('prefers the static route over a param', () => {
    expect(findRoute(routes, '/transactions/new')?.route.pattern).toBe('/transactions/new');
  });

  it('returns null for an unknown path', () => {
    expect(findRoute(routes, '/nowhere')).toBeNull();
  });
});
