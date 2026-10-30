/** How long an "offline" answer is trusted before the next request checks again. */
export const OFFLINE_RECHECK_MS = 60_000;

interface KnownAvailability {
  readonly isAvailable: boolean;
  readonly checkedAt: number;
}

/**
 * Whether the AI coach answers, checked once and remembered. "Available" holds for the session; "offline" is
 * re-checked after `OFFLINE_RECHECK_MS`, so a server that comes back is picked up without a reload.
 * A failed check counts as offline: the app then answers from Luka's script.
 */
export class AvailabilityCache {
  private readonly check: () => Promise<boolean>;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private known: KnownAvailability | null = null;
  private inFlight: Promise<boolean> | null = null;

  constructor(check: () => Promise<boolean>, now: () => number = Date.now) {
    this.check = check;
    this.now = now;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The last answer, or null before the first check has finished. */
  readonly lastKnown = (): boolean | null => this.known?.isAvailable ?? null;

  /** Resolves with the remembered answer while it holds, otherwise checks again (one check at a time). */
  resolve(): Promise<boolean> {
    if (this.known && this.isFresh(this.known)) return Promise.resolve(this.known.isAvailable);
    this.inFlight ??= this.check()
      .catch(() => false)
      .then((isAvailable) => {
        this.inFlight = null;
        this.record(isAvailable);
        return isAvailable;
      });
    return this.inFlight;
  }

  /** Called when a request finds the AI unreachable, so the screens switch to the script straight away. */
  markOffline(): void {
    this.record(false);
  }

  private isFresh(known: KnownAvailability): boolean {
    return known.isAvailable || this.now() - known.checkedAt < OFFLINE_RECHECK_MS;
  }

  private record(isAvailable: boolean): void {
    const changed = this.known?.isAvailable !== isAvailable;
    this.known = { isAvailable, checkedAt: this.now() };
    if (changed) this.listeners.forEach((listener) => listener());
  }
}
