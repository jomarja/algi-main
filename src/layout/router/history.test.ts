import { createBrowserHistory } from './history.ts';

interface Entry {
  url: URL;
  state: unknown;
}

/** Just enough of `window` (location, history, popstate) to drive createBrowserHistory in Node. */
function installFakeWindow(startUrl: string) {
  const entries: Entry[] = [{ url: new URL(startUrl), state: null }];
  let index = 0;
  const popListeners = new Set<(event: { state: unknown }) => void>();
  const current = () => entries[index];

  const fakeWindow = {
    location: {
      get href() {
        return current().url.href;
      },
      get pathname() {
        return current().url.pathname;
      },
      get search() {
        return current().url.search;
      },
      get hash() {
        return current().url.hash;
      },
    },
    history: {
      get state() {
        return current().state;
      },
      pushState(state: unknown, _title: string, url: string) {
        entries.splice(index + 1);
        entries.push({ url: new URL(url, current().url), state });
        index += 1;
      },
      replaceState(state: unknown, _title: string, url?: string) {
        entries[index] = { url: url ? new URL(url, current().url) : current().url, state };
      },
      back() {
        if (index === 0) return;
        index -= 1;
        popListeners.forEach((listener) => listener({ state: current().state }));
      },
    },
    addEventListener(type: string, listener: (event: { state: unknown }) => void) {
      if (type === 'popstate') popListeners.add(listener);
    },
    removeEventListener(type: string, listener: (event: { state: unknown }) => void) {
      if (type === 'popstate') popListeners.delete(listener);
    },
  };
  vi.stubGlobal('window', fakeWindow);
  return { popListeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createBrowserHistory', () => {
  it('starts with the current URL at index 0', () => {
    installFakeWindow('https://algi.test/plan?from=coach#top');
    const { location, action } = createBrowserHistory().getSnapshot();
    expect(location).toMatchObject({ pathname: '/plan', search: '?from=coach', hash: '#top', index: 0 });
    expect(action).toBe('initial');
  });

  it('keeps the key and index of an entry it tagged before a reload', () => {
    installFakeWindow('https://algi.test/plan');
    window.history.replaceState({ algi: { key: 'kept', index: 4 } }, '');
    expect(createBrowserHistory().getSnapshot().location).toMatchObject({ key: 'kept', index: 4 });
  });

  it('pushes a new entry with a new key and the next index', () => {
    installFakeWindow('https://algi.test/');
    const history = createBrowserHistory();
    const first = history.getSnapshot().location;
    history.push('/plan/what-if');
    const { location, action } = history.getSnapshot();
    expect(action).toBe('push');
    expect(location.pathname).toBe('/plan/what-if');
    expect(location.index).toBe(first.index + 1);
    expect(location.key).not.toBe(first.key);
  });

  it('replaces instead of stacking a duplicate when pushing the current URL', () => {
    installFakeWindow('https://algi.test/plan');
    const history = createBrowserHistory();
    history.push('/plan');
    expect(history.getSnapshot()).toMatchObject({ action: 'replace', location: { index: 0 } });
  });

  it('replaces the entry in place, keeping its index', () => {
    installFakeWindow('https://algi.test/plan');
    const history = createBrowserHistory();
    history.push('/plan/loans');
    history.replace('/plan/budget');
    expect(history.getSnapshot()).toMatchObject({ action: 'replace', location: { pathname: '/plan/budget', index: 1 } });
  });

  it('notifies subscribers and restores the earlier entry on back', () => {
    installFakeWindow('https://algi.test/plan');
    const history = createBrowserHistory();
    const listener = vi.fn();
    history.subscribe(listener);
    const start = history.getSnapshot().location;
    history.push('/plan/loans');
    history.back();
    const { location, action } = history.getSnapshot();
    expect(action).toBe('pop');
    expect(location).toMatchObject({ pathname: '/plan', key: start.key, index: 0 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('listens for popstate only while someone is subscribed', () => {
    const { popListeners } = installFakeWindow('https://algi.test/');
    const history = createBrowserHistory();
    const unsubscribe = history.subscribe(() => undefined);
    expect(popListeners.size).toBe(1);
    unsubscribe();
    expect(popListeners.size).toBe(0);
  });
});
