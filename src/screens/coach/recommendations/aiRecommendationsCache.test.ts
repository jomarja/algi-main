import type { CoachRecommendation, CoachRecommendationsRequest, CoachRecommendationsResponse } from '../../../../shared/coach.ts';
import { ApiError } from '../../../api/http.ts';
import { AiRecommendationsCache, recommendationsCacheKey, shownResponse } from './aiRecommendationsCache.ts';

const request: CoachRecommendationsRequest = {
  context: {
    language: 'en',
    displayCurrency: 'GEL',
    userFirstName: 'Nino',
    objective: 'buildSavings',
    goals: [],
    summary: null,
    screen: '/coach/recommendations',
  },
};

function recommendation(id: string, title = `Title ${id}`): CoachRecommendation {
  return {
    id,
    title,
    detail: 'Detail',
    impactMonthly: 60,
    category: 'foodDelivery',
    action: 'review_budget',
    evidence: ['Food delivery: 186.40 ₾'],
    priority: 'medium',
  };
}

function response(...recommendations: CoachRecommendation[]): CoachRecommendationsResponse {
  return { recommendations, generatedAt: '2026-10-30T09:00:00.000Z', model: 'claude' };
}

/** A fetcher whose answers the test settles by hand. */
function controlledFetcher() {
  const pending: Array<{ resolve: (value: CoachRecommendationsResponse) => void; reject: (error: unknown) => void }> = [];
  const fetcher = vi.fn(
    (_request: CoachRecommendationsRequest) =>
      new Promise<CoachRecommendationsResponse>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
  );
  return {
    fetcher,
    resolveNext: async (value: CoachRecommendationsResponse) => {
      pending.shift()?.resolve(value);
      await Promise.resolve();
    },
    rejectNext: async (error: unknown) => {
      pending.shift()?.reject(error);
      await Promise.resolve();
    },
  };
}

const key = recommendationsCacheKey({ language: 'en', displayCurrency: 'GEL' });

describe('recommendationsCacheKey', () => {
  it('keeps a copy per language and display currency', () => {
    expect(key).not.toBe(recommendationsCacheKey({ language: 'ka', displayCurrency: 'GEL' }));
    expect(key).not.toBe(recommendationsCacheKey({ language: 'en', displayCurrency: 'USD' }));
  });
});

describe('AiRecommendationsCache', () => {
  it('is idle before anything loads', () => {
    const cache = new AiRecommendationsCache(controlledFetcher().fetcher);
    expect(cache.snapshot(key)).toEqual({ status: 'idle' });
    expect(cache.snapshot(key)).toBe(cache.snapshot(key));
  });

  it('loads once and keeps the answer for the session', async () => {
    const { fetcher, resolveNext } = controlledFetcher();
    const cache = new AiRecommendationsCache(fetcher);

    cache.load(key, request);
    cache.load(key, request);
    expect(cache.snapshot(key)).toEqual({ status: 'loading', previous: null });
    await resolveNext(response(recommendation('rec-1')));
    cache.load(key, request);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(request);
    expect(cache.snapshot(key)).toEqual({ status: 'loaded', response: response(recommendation('rec-1')) });
  });

  it('refreshes when forced, showing the previous answer meanwhile', async () => {
    const { fetcher, resolveNext } = controlledFetcher();
    const cache = new AiRecommendationsCache(fetcher);
    cache.load(key, request);
    await resolveNext(response(recommendation('rec-1', 'Old')));

    cache.load(key, request, { force: true });
    expect(shownResponse(cache.snapshot(key))?.recommendations[0].title).toBe('Old');
    await resolveNext(response(recommendation('rec-1', 'New')));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.find(key, 'rec-1')?.title).toBe('New');
  });

  it('records why a load failed and keeps the previous answer', async () => {
    const { fetcher, resolveNext, rejectNext } = controlledFetcher();
    const cache = new AiRecommendationsCache(fetcher);
    cache.load(key, request);
    await resolveNext(response(recommendation('rec-1')));

    cache.load(key, request, { force: true });
    await rejectNext(new ApiError('http', 'busy', { status: 429, code: 'rate_limited' }));

    expect(cache.snapshot(key)).toEqual({ status: 'failed', failure: 'rateLimited', previous: response(recommendation('rec-1')) });
    expect(cache.find(key, 'rec-1')).not.toBeNull();
  });

  it('tries again on the next load after a failure', async () => {
    const { fetcher, rejectNext } = controlledFetcher();
    const cache = new AiRecommendationsCache(fetcher);
    cache.load(key, request);
    await rejectNext(new ApiError('network', 'offline'));
    expect(cache.snapshot(key)).toMatchObject({ status: 'failed', failure: 'offline' });

    cache.load(key, request);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('finds a suggestion by id only under its own key', async () => {
    const { fetcher, resolveNext } = controlledFetcher();
    const cache = new AiRecommendationsCache(fetcher);
    cache.load(key, request);
    await resolveNext(response(recommendation('rec-1'), recommendation('rec-2')));

    expect(cache.find(key, 'rec-2')?.id).toBe('rec-2');
    expect(cache.find(key, 'rec-9')).toBeNull();
    expect(cache.find(recommendationsCacheKey({ language: 'ka', displayCurrency: 'GEL' }), 'rec-2')).toBeNull();
  });

  it('tells subscribers about every change', async () => {
    const { fetcher, resolveNext } = controlledFetcher();
    const cache = new AiRecommendationsCache(fetcher);
    const listener = vi.fn();
    const unsubscribe = cache.subscribe(listener);

    cache.load(key, request);
    await resolveNext(response(recommendation('rec-1')));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    cache.load(key, request, { force: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
