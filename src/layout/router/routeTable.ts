import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { LocalizedText } from '../../engine/localization.ts';
import type { TabId } from '../tabs.ts';
import { joinPaths, matchPath, paramCount } from './matchPath.ts';
import type { RouteParams } from './matchPath.ts';

/**
 * How much navigation chrome a screen gets:
 * - 'tabs': phone tab bar / laptop sidebar (tab roots and screens pushed onto them)
 * - 'stack': no phone tab bar, like an iOS sheet covering the tabs (settings, paywall, add forms); sidebar on laptops
 * - 'bare': no navigation chrome at all (onboarding)
 */
export type RouteChrome = 'tabs' | 'stack' | 'bare';

/** Onboarding steps are only reachable before onboarding is complete, app screens only after; 'any' always. */
export type RouteAccess = 'onboarding' | 'app' | 'any';

export interface ScreenProps {
  params: RouteParams;
  route: ResolvedRoute;
}

export interface ScreenModule {
  default: ComponentType<ScreenProps>;
}

export type ScreenLoader = () => Promise<ScreenModule>;

export interface RouteConfig {
  /**
   * Path relative to the parent ('plan', 'what-if', ':goalId'; the root screen is ''), or absolute ('/goals/:goalId')
   * for a screen that belongs under a parent without sharing its URL prefix.
   */
  path: string;
  /** Used for the document title and as the header title until the screen sets its own. */
  title: LocalizedText;
  /** Omit for a grouping node that only shares a path prefix and settings with its children. */
  screen?: ScreenLoader;
  /** Inherited from the parent when omitted; null highlights no tab. */
  tab?: TabId | null;
  chrome?: RouteChrome;
  access?: RouteAccess;
  children?: readonly RouteConfig[];
}

export interface ResolvedRoute {
  /** Absolute pattern, e.g. '/goals/:goalId'. */
  pattern: string;
  title: LocalizedText;
  tab: TabId | null;
  chrome: RouteChrome;
  access: RouteAccess;
  /** The nearest ancestor with a screen: where Back goes when there's no history to return to. */
  parent: ResolvedRoute | null;
  /** Nesting level below a tab root, used to tell a push from a pop when animating. */
  depth: number;
  Screen: LazyExoticComponent<ComponentType<ScreenProps>>;
}

export interface RouteMatch {
  route: ResolvedRoute;
  params: RouteParams;
}

interface InheritedSettings {
  tab: TabId | null;
  chrome: RouteChrome;
  access: RouteAccess;
}

const rootSettings: InheritedSettings = { tab: null, chrome: 'tabs', access: 'app' };

/** Flattens the nested route table into matchable routes, static paths ahead of dynamic ones. */
export function resolveRoutes(configs: readonly RouteConfig[]): ResolvedRoute[] {
  const resolved: ResolvedRoute[] = [];

  const visit = (config: RouteConfig, parentPath: string, inherited: InheritedSettings, parent: ResolvedRoute | null) => {
    const pattern = joinPaths(config.path.startsWith('/') ? '/' : parentPath, config.path);
    const settings: InheritedSettings = {
      tab: config.tab === undefined ? inherited.tab : config.tab,
      chrome: config.chrome ?? inherited.chrome,
      access: config.access ?? inherited.access,
    };
    const route: ResolvedRoute | null = config.screen
      ? {
          pattern,
          title: config.title,
          ...settings,
          parent,
          depth: parent ? parent.depth + 1 : 0,
          Screen: lazy(config.screen),
        }
      : null;
    if (route) resolved.push(route);
    for (const child of config.children ?? []) visit(child, pattern, settings, route ?? parent);
  };

  for (const config of configs) visit(config, '/', rootSettings, null);
  // Array.prototype.sort is stable, so routes with equal specificity keep their table order.
  return resolved.sort((a, b) => paramCount(a.pattern) - paramCount(b.pattern));
}

export function findRoute(routes: readonly ResolvedRoute[], pathname: string): RouteMatch | null {
  for (const route of routes) {
    const params = matchPath(route.pattern, pathname);
    if (params) return { route, params };
  }
  return null;
}
