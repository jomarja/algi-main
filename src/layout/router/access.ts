import type { RouteAccess } from './routeTable.ts';

/**
 * Where a screen sends the user given their onboarding progress (RootView.swift): app screens go to the welcome
 * screen until onboarding is complete, onboarding screens go home after it. Null means stay.
 */
export function accessRedirect(access: RouteAccess, isOnboardingComplete: boolean): string | null {
  if (access === 'app' && !isOnboardingComplete) return '/welcome';
  if (access === 'onboarding' && isOnboardingComplete) return '/';
  return null;
}
