import type { BankConsent, BankSnapshot } from '../../shared/bank.ts';
import type { Session } from '../http.ts';
import type { TokenSet } from './oauth.ts';

/** One browser session's open banking state. Server-side only: tokens and PKCE verifiers never leave it. */

/** Between POST /api/bank/connect and TBC's redirect back to the callback. */
export interface PendingAuthorisation {
  consentId: string;
  validUntil: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  /** Epoch milliseconds. */
  startedAt: number;
}

export interface BankConnection {
  consent: BankConsent;
  tokens: TokenSet;
  /** The PSU's address for PSU-IP-Address, kept for reads the AI coach starts outside a bank request. */
  psuIpAddress: string;
  lastSyncedAt: string | null;
}

export interface CachedSnapshot {
  snapshot: BankSnapshot;
  /** Epoch milliseconds. */
  cachedAt: number;
}

export interface BankSessionState {
  pending: PendingAuthorisation | null;
  connection: BankConnection | null;
  cache: CachedSnapshot | null;
}

const sessionKey = 'openbanking';
const emptyState: BankSessionState = { pending: null, connection: null, cache: null };

export function readBankState(session: Session): BankSessionState {
  return session.get<BankSessionState>(sessionKey) ?? emptyState;
}

export function updateBankState(session: Session, changes: Partial<BankSessionState>): void {
  session.set(sessionKey, { ...readBankState(session), ...changes });
}

export function clearBankState(session: Session): void {
  session.delete(sessionKey);
}
