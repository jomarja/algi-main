export type NavigationAction = 'initial' | 'push' | 'replace' | 'pop';

export interface AppLocation {
  pathname: string;
  search: string;
  hash: string;
  /** Unique per history entry; keys scroll positions. */
  key: string;
  /** Position in this tab's history since the app first loaded, so Back knows whether it would leave the app. */
  index: number;
}

export interface HistorySnapshot {
  location: AppLocation;
  action: NavigationAction;
}

export interface BrowserHistory {
  getSnapshot(): HistorySnapshot;
  subscribe(listener: () => void): () => void;
  push(to: string): void;
  replace(to: string): void;
  back(): void;
}

interface EntryState {
  key: string;
  index: number;
}

const stateField = 'algi';

function createKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function readEntry(state: unknown): EntryState | null {
  if (typeof state !== 'object' || state === null || !(stateField in state)) return null;
  const entry = (state as Record<string, unknown>)[stateField];
  if (typeof entry !== 'object' || entry === null) return null;
  const { key, index } = entry as Record<string, unknown>;
  return typeof key === 'string' && typeof index === 'number' ? { key, index } : null;
}

function locationOf(entry: EntryState): AppLocation {
  const { pathname, search, hash } = window.location;
  return { pathname, search, hash, key: entry.key, index: entry.index };
}

/** A thin layer over the History API that tags each entry with a key and an index. */
export function createBrowserHistory(): BrowserHistory {
  const listeners = new Set<() => void>();

  let entry = readEntry(window.history.state) ?? { key: createKey(), index: 0 };
  window.history.replaceState({ [stateField]: entry }, '');
  let snapshot: HistorySnapshot = { location: locationOf(entry), action: 'initial' };

  const publish = (action: NavigationAction) => {
    snapshot = { location: locationOf(entry), action };
    listeners.forEach((listener) => listener());
  };

  const onPopState = (event: PopStateEvent) => {
    entry = readEntry(event.state) ?? { key: createKey(), index: 0 };
    publish('pop');
  };

  const replace = (to: string) => {
    entry = { key: createKey(), index: entry.index };
    window.history.replaceState({ [stateField]: entry }, '', to);
    publish('replace');
  };

  const push = (to: string) => {
    // Tapping a link to the screen you're on shouldn't stack a duplicate entry.
    if (new URL(to, window.location.href).href === window.location.href) {
      replace(to);
      return;
    }
    entry = { key: createKey(), index: entry.index + 1 };
    window.history.pushState({ [stateField]: entry }, '', to);
    publish('push');
  };

  const subscribe = (listener: () => void) => {
    if (listeners.size === 0) window.addEventListener('popstate', onPopState);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.removeEventListener('popstate', onPopState);
    };
  };

  return {
    getSnapshot: () => snapshot,
    subscribe,
    push,
    replace,
    back: () => window.history.back(),
  };
}
