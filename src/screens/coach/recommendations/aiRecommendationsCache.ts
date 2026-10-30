import type {
  CoachAppContext,
  CoachRecommendation,
  CoachRecommendationsRequest,
  CoachRecommendationsResponse,
} from '../../../../shared/coach.ts';
import { classifyCoachError, type CoachFailure } from '../shared/coachErrors.ts';

export type AiRecommendationsSnapshot =
  | { readonly status: 'idle' }
  /** `previous` stays on screen while a refresh loads. */
  | { readonly status: 'loading'; readonly previous: CoachRecommendationsResponse | null }
  | { readonly status: 'loaded'; readonly response: CoachRecommendationsResponse }
  | { readonly status: 'failed'; readonly failure: CoachFailure; readonly previous: CoachRecommendationsResponse | null };

const idle: AiRecommendationsSnapshot = { status: 'idle' };

/**
 * Luka's suggestions are written in the app language and amounts in the display currency, so each pair keeps
 * its own copy: switching language shows the right one, or loads it.
 */
export function recommendationsCacheKey(context: Pick<CoachAppContext, 'language' | 'displayCurrency'>): string {
  return `${context.language}|${context.displayCurrency}`;
}

/** The suggestions a snapshot can show: the latest, or the previous ones while refreshing or after a failure. */
export function shownResponse(snapshot: AiRecommendationsSnapshot): CoachRecommendationsResponse | null {
  switch (snapshot.status) {
    case 'idle':
      return null;
    case 'loaded':
      return snapshot.response;
    case 'loading':
    case 'failed':
      return snapshot.previous;
  }
}

/**
 * Luka's AI suggestions, fetched once and kept in memory for the session (never persisted: they quote the
 * user's figures). A load is skipped while one is running, and once there is an answer unless forced (Refresh);
 * after a failure the next load tries again.
 */
export class AiRecommendationsCache {
  private readonly fetchRecommendations: (request: CoachRecommendationsRequest) => Promise<CoachRecommendationsResponse>;
  private readonly entries = new Map<string, AiRecommendationsSnapshot>();
  private readonly listeners = new Set<() => void>();

  constructor(fetchRecommendations: (request: CoachRecommendationsRequest) => Promise<CoachRecommendationsResponse>) {
    this.fetchRecommendations = fetchRecommendations;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot(key: string): AiRecommendationsSnapshot {
    return this.entries.get(key) ?? idle;
  }

  /** Loads the suggestions for `key` unless they are loading or loaded; `force` refreshes loaded ones. */
  load(key: string, request: CoachRecommendationsRequest, options: { force?: boolean } = {}): void {
    const current = this.snapshot(key);
    if (current.status === 'loading') return;
    if (current.status === 'loaded' && !options.force) return;

    const previous = shownResponse(current);
    this.set(key, { status: 'loading', previous });
    this.fetchRecommendations(request).then(
      (response) => this.set(key, { status: 'loaded', response }),
      (error: unknown) => this.set(key, { status: 'failed', failure: classifyCoachError(error), previous }),
    );
  }

  /** A suggestion by id from what `key` shows, for its detail page. */
  find(key: string, id: string): CoachRecommendation | null {
    return shownResponse(this.snapshot(key))?.recommendations.find((recommendation) => recommendation.id === id) ?? null;
  }

  private set(key: string, snapshot: AiRecommendationsSnapshot): void {
    this.entries.set(key, snapshot);
    this.listeners.forEach((listener) => listener());
  }
}
