import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { CoachRecommendation } from '../../../../shared/coach.ts';
import type { AppStore } from '../../../state/appStore.ts';
import { aiAvailability, aiRecommendations } from '../shared/coachApi.ts';
import { useAiAvailability, type AiAvailability } from '../shared/useAiAvailability.ts';
import { recommendationsCacheKey, type AiRecommendationsSnapshot } from './aiRecommendationsCache.ts';
import { RECOMMENDATIONS_PATH } from './destinations.ts';

export interface AiRecommendationsCacheView {
  readonly snapshot: AiRecommendationsSnapshot;
  find(id: string): CoachRecommendation | null;
}

/** What the session cache holds for the current language and currency, without loading anything. */
export function useAiRecommendationsCache(store: AppStore): AiRecommendationsCacheView {
  const { language, displayCurrency } = store.getState();
  const key = recommendationsCacheKey({ language, displayCurrency });
  const snapshot = useSyncExternalStore(
    aiRecommendations.subscribe,
    () => aiRecommendations.snapshot(key),
    () => aiRecommendations.snapshot(key),
  );
  const find = useCallback((id: string) => aiRecommendations.find(key, id), [key]);
  return { snapshot, find };
}

export interface AiRecommendations extends AiRecommendationsCacheView {
  readonly availability: AiAvailability;
  /**
   * The user turned off using transactions for coaching. The server reads the bank for every AI request,
   * so no AI suggestions are requested then.
   */
  readonly isCoachingDataOff: boolean;
  refresh(): void;
}

/**
 * Luka's AI suggestions (POST /api/coach/recommendations) in the current language and currency: loaded when the
 * AI is available, kept for the session, refreshed on request. An unreachable AI switches the app to offline.
 */
export function useAiRecommendations(store: AppStore): AiRecommendations {
  const availability = useAiAvailability();
  const cache = useAiRecommendationsCache(store);
  const { language, displayCurrency, permissions } = store.getState();
  const key = recommendationsCacheKey({ language, displayCurrency });
  const isCoachingDataOff = !permissions.useTransactionsForCoaching;
  const canLoad = availability === 'online' && !isCoachingDataOff;

  useEffect(() => {
    if (canLoad) aiRecommendations.load(key, { context: store.coachContext(RECOMMENDATIONS_PATH) });
  }, [canLoad, key, store]);

  const isUnreachable = cache.snapshot.status === 'failed' && cache.snapshot.failure === 'offline';
  useEffect(() => {
    if (isUnreachable) aiAvailability.markOffline();
  }, [isUnreachable]);

  const refresh = useCallback(() => {
    aiRecommendations.load(key, { context: store.coachContext(RECOMMENDATIONS_PATH) }, { force: true });
  }, [key, store]);

  return { ...cache, availability, isCoachingDataOff, refresh };
}
