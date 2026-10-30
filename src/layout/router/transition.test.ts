import { lt } from '../../engine/localization.ts';
import type { AppLocation } from './history.ts';
import { resolveRoutes } from './routeTable.ts';
import type { RouteConfig, ScreenLoader } from './routeTable.ts';
import { transitionBetween } from './transition.ts';
import type { ShownScreen } from './transition.ts';

const screen: ScreenLoader = () => Promise.resolve({ default: () => null });

const routes = resolveRoutes([
  {
    path: 'plan',
    title: lt('Plan', 'გეგმა'),
    screen,
    tab: 'plan',
    children: [
      { path: 'what-if', title: lt('What if', 'რა მოხდება'), screen },
      { path: 'loans', title: lt('Loans', 'სესხები'), screen },
      { path: 'new', title: lt('New', 'ახალი'), screen, chrome: 'stack' },
    ],
  },
  { path: 'coach', title: lt('Coach', 'ქოუჩი'), screen, tab: 'coach' },
] satisfies RouteConfig[]);

function shown(pattern: string | null, index = 0): ShownScreen {
  const location: AppLocation = { pathname: pattern ?? '/missing', search: '', hash: '', key: `k${index}`, index };
  return { location, route: routes.find((route) => route.pattern === pattern) ?? null };
}

describe('transitionBetween', () => {
  it('does not animate the first screen', () => {
    expect(transitionBetween(null, shown('/plan'), 'initial')).toBe('none');
  });

  it('slides in a deeper screen of the same tab', () => {
    expect(transitionBetween(shown('/plan'), shown('/plan/what-if', 1), 'push')).toBe('push');
  });

  it('slides back to a shallower screen', () => {
    expect(transitionBetween(shown('/plan/what-if', 1), shown('/plan', 2), 'push')).toBe('pop');
  });

  it('cross-fades between tabs', () => {
    expect(transitionBetween(shown('/plan'), shown('/coach', 1), 'push')).toBe('fade');
  });

  it('cross-fades between siblings', () => {
    expect(transitionBetween(shown('/plan/what-if'), shown('/plan/loans', 1), 'push')).toBe('fade');
  });

  it('cross-fades when the chrome changes', () => {
    expect(transitionBetween(shown('/plan'), shown('/plan/new', 1), 'push')).toBe('fade');
  });

  it('cross-fades replacements', () => {
    expect(transitionBetween(shown('/plan'), shown('/plan/what-if'), 'replace')).toBe('fade');
  });

  it('cross-fades to and from unknown pages', () => {
    expect(transitionBetween(shown('/plan'), shown(null, 1), 'push')).toBe('fade');
  });

  it('uses the history direction for browser back and forward', () => {
    expect(transitionBetween(shown('/plan/what-if', 3), shown('/plan', 2), 'pop')).toBe('pop');
    expect(transitionBetween(shown('/plan', 2), shown('/plan/what-if', 3), 'pop')).toBe('push');
  });
});
