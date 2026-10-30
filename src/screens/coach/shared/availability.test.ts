import { AvailabilityCache, OFFLINE_RECHECK_MS } from './availability.ts';

function cacheWith(answers: Array<boolean | Error>) {
  let time = 0;
  const check = vi.fn(async () => {
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return answer ?? false;
  });
  const cache = new AvailabilityCache(check, () => time);
  return {
    cache,
    check,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
  };
}

describe('AvailabilityCache', () => {
  it('knows nothing before the first check finishes', () => {
    const { cache } = cacheWith([true]);
    expect(cache.lastKnown()).toBeNull();
  });

  it('checks once for concurrent callers', async () => {
    const { cache, check } = cacheWith([true]);
    await expect(Promise.all([cache.resolve(), cache.resolve()])).resolves.toEqual([true, true]);
    expect(check).toHaveBeenCalledTimes(1);
    expect(cache.lastKnown()).toBe(true);
  });

  it('remembers "available" for the session', async () => {
    const { cache, check, advance } = cacheWith([true, false]);
    await cache.resolve();
    advance(OFFLINE_RECHECK_MS * 10);
    await expect(cache.resolve()).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('checks "offline" again once the recheck window has passed', async () => {
    const { cache, check, advance } = cacheWith([false, true]);
    await cache.resolve();
    advance(OFFLINE_RECHECK_MS - 1);
    await expect(cache.resolve()).resolves.toBe(false);
    advance(1);
    await expect(cache.resolve()).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('treats a failed check as offline', async () => {
    const { cache } = cacheWith([new Error('offline')]);
    await expect(cache.resolve()).resolves.toBe(false);
    expect(cache.lastKnown()).toBe(false);
  });

  it('goes offline when a request finds the AI unreachable, and tells subscribers', async () => {
    const { cache, check } = cacheWith([true]);
    await cache.resolve();
    const listener = vi.fn();
    cache.subscribe(listener);

    cache.markOffline();

    expect(cache.lastKnown()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(cache.resolve()).resolves.toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('only notifies subscribers when the answer changes', async () => {
    const { cache, advance } = cacheWith([false, false]);
    const listener = vi.fn();
    const unsubscribe = cache.subscribe(listener);
    await cache.resolve();
    advance(OFFLINE_RECHECK_MS);
    await cache.resolve();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    cache.markOffline();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
