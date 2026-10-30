/**
 * The round trip through TBC's consent page. The server's callback always lands on `/?bank=connected` or
 * `/?bank=error&reason=…`, so the app remembers where the user started and returns them there.
 */

export type BankConsentOutcome = 'connected' | 'error';

export interface BankConsentReturn {
  outcome: BankConsentOutcome;
  /** Why it failed, e.g. 'access_denied', 'session_expired', 'state_mismatch'; null on success. */
  reason: string | null;
}

const returnPathKey = 'algi.bank.returnPath';

/** A same-origin path such as '/settings', never '//host' or a full URL. */
function isAppPath(value: string | null): value is string {
  return value !== null && value.startsWith('/') && !value.startsWith('//');
}

/** Leaves for the bank's consent page, remembering the current screen to come back to. */
export function redirectToBankConsent(authorizeUrl: string): void {
  try {
    sessionStorage.setItem(returnPathKey, window.location.pathname + window.location.search);
  } catch {
    // Storage can be blocked (private mode); the user then lands on the default screen.
  }
  window.location.assign(authorizeUrl);
}

/**
 * Reads the consent outcome from a URL. `returnPath` is where to send the user: the remembered screen,
 * or the same URL without the bank parameters.
 */
export function parseBankConsentReturn(
  href: string,
  rememberedPath: string | null,
): { result: BankConsentReturn; returnPath: string } | null {
  const url = new URL(href);
  const outcome = url.searchParams.get('bank');
  if (outcome !== 'connected' && outcome !== 'error') return null;

  const reason = outcome === 'error' ? url.searchParams.get('reason') : null;
  url.searchParams.delete('bank');
  url.searchParams.delete('reason');
  const cleaned = url.pathname + url.search + url.hash;
  return { result: { outcome, reason }, returnPath: isAppPath(rememberedPath) ? rememberedPath : cleaned };
}

function takeRememberedPath(): string | null {
  try {
    const path = sessionStorage.getItem(returnPathKey);
    sessionStorage.removeItem(returnPathKey);
    return path;
  } catch {
    return null;
  }
}

/**
 * Call once at startup, before the router reads the URL: returns the consent outcome if the user just came back
 * from the bank, and rewrites the URL to the screen they left.
 */
export function takeBankConsentReturn(): BankConsentReturn | null {
  const parsed = parseBankConsentReturn(window.location.href, takeRememberedPath());
  if (!parsed) return null;
  window.history.replaceState(window.history.state, '', parsed.returnPath);
  return parsed.result;
}
