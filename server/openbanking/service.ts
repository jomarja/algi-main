import type { BankConnectionStatus, BankConnectResponse, BankDataSourceKind, BankSnapshot } from '../../shared/bank.ts';
import type { TbcConfig, TbcMode } from '../config.ts';
import type { BankDataSource } from '../contracts.ts';
import type { Session } from '../http.ts';
import { HttpError } from '../http.ts';
import { addDays, toIsoDate } from './dates.ts';
import type { TbcError } from './errors.ts';
import { TbcApiError, bankErrorToHttp, isAccessTokenRejected, isConsentRejected, isTbcError } from './errors.ts';
import { normalizeBankData } from './normalize.ts';
import type { BankLanguage, TokenSet } from './oauth.ts';
import { buildAuthorizeUrl, isAccessTokenExpired, tokenSetFrom, usableRefreshToken } from './oauth.ts';
import { createPkcePair, randomUrlSafe, safeEqual } from './pkce.ts';
import type { BankConnection, BankSessionState, PendingAuthorisation } from './session-state.ts';
import { clearBankState, readBankState, updateBankState } from './session-state.ts';
import { fetchBankData } from './sync.ts';
import type { TbcClient } from './tbc-client.ts';

export interface SnapshotOptions {
  /** Read from TBC even when a recent snapshot is cached. */
  refresh?: boolean;
  /** The PSU's address, when a browser request asks for the snapshot. */
  psuIpAddress?: string;
}

export interface BankServiceDependencies {
  tbc: TbcConfig;
  client: TbcClient;
  now?: () => Date;
}

const snapshotTtlMs = 3 * 60_000;
const pendingAuthorisationTtlMs = 15 * 60_000;
/** PSD2 consent statuses after which the consent can't be used. */
const unusableConsentStatuses: ReadonlySet<string> = new Set(['rejected', 'revokedByPsu', 'expired', 'terminatedByTpp']);
/** RFC 6749 authorize errors, passed to the app as the reason; anything else becomes authorization_failed. */
const oauthErrorCodes: ReadonlySet<string> = new Set([
  'access_denied',
  'invalid_request',
  'unauthorized_client',
  'unsupported_response_type',
  'invalid_scope',
  'server_error',
  'temporarily_unavailable',
]);
const sourceByMode: Record<TbcMode, BankDataSourceKind> = { mock: 'mock', sandbox: 'tbc-sandbox', production: 'tbc-production' };

/** Connecting the bank failed; `reason` reaches the app in the callback redirect. */
class AuthorisationFailure extends Error {
  readonly reason: string;

  constructor(reason: string, options?: { cause?: unknown }) {
    super(reason, options);
    this.reason = reason;
  }
}

/** The connection can't be used any more: its refresh token expired or TBC no longer accepts it. */
class ConnectionExpired extends Error {}

/**
 * The TBC connection of each browser session: the consent and OAuth flow, then cached, normalised snapshots of
 * the PSU's accounts. Tokens and PKCE secrets stay in the server-side session.
 */
export class BankService implements BankDataSource {
  readonly source: BankDataSourceKind;
  private readonly tbc: TbcConfig;
  private readonly client: TbcClient;
  private readonly now: () => Date;
  /** One TBC read per session at a time: the app and the AI coach often ask at once. */
  private readonly inFlight = new WeakMap<Session, Promise<BankSnapshot>>();

  constructor({ tbc, client, now = () => new Date() }: BankServiceDependencies) {
    this.tbc = tbc;
    this.client = client;
    this.now = now;
    this.source = sourceByMode[tbc.mode];
  }

  status(session: Session): BankConnectionStatus {
    const { connection } = readBankState(session);
    return {
      connected: connection !== null,
      source: this.source,
      consent: connection?.consent ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
    };
  }

  // MARK: Connecting

  /** Creates the AIS consent at TBC and returns the authorize URL the PSU opens to approve it. */
  async connect(session: Session, language: BankLanguage, psuIpAddress: string): Promise<BankConnectResponse> {
    const validUntil = toIsoDate(addDays(this.now(), this.tbc.consentDays));
    const { consentId } = await this.callTbc(() => this.client.createConsent({ validUntil, psuIpAddress, language }));
    const pkce = createPkcePair();
    const pending: PendingAuthorisation = {
      consentId,
      validUntil,
      state: randomUrlSafe(),
      nonce: randomUrlSafe(),
      codeVerifier: pkce.verifier,
      startedAt: this.nowMs(),
    };
    updateBankState(session, { pending });
    return {
      authorizeUrl: buildAuthorizeUrl(this.tbc, {
        consentId,
        state: pending.state,
        nonce: pending.nonce,
        codeChallenge: pkce.challenge,
        language,
      }),
    };
  }

  /** Handles TBC's redirect back to the callback and returns where to send the browser next. */
  async completeAuthorisation(session: Session, params: URLSearchParams, psuIpAddress: string): Promise<string> {
    const { pending } = readBankState(session);
    updateBankState(session, { pending: null }); // single use, whatever the outcome
    try {
      const connection = await this.authorise(pending, params, psuIpAddress);
      updateBankState(session, { connection, cache: null });
      this.inFlight.delete(session);
      return '/?bank=connected';
    } catch (error) {
      return `/?bank=error&reason=${encodeURIComponent(this.failureReason(error))}`;
    }
  }

  private async authorise(
    pending: PendingAuthorisation | null,
    params: URLSearchParams,
    psuIpAddress: string,
  ): Promise<BankConnection> {
    if (!pending || this.nowMs() - pending.startedAt > pendingAuthorisationTtlMs) {
      throw new AuthorisationFailure('session_expired');
    }
    const state = params.get('state');
    if (!state || !safeEqual(state, pending.state)) throw new AuthorisationFailure('state_mismatch');
    const error = params.get('error');
    if (error) throw new AuthorisationFailure(oauthErrorCodes.has(error) ? error : 'authorization_failed');
    const code = params.get('code');
    if (!code) throw new AuthorisationFailure('missing_code');

    const grant = await this.client.exchangeAuthorizationCode(code, pending.codeVerifier).catch((cause: unknown) => {
      throw new AuthorisationFailure('token_exchange_failed', { cause });
    });
    const status = await this.consentStatusAfterAuthorisation(pending.consentId, psuIpAddress);
    if (unusableConsentStatuses.has(status)) throw new AuthorisationFailure('consent_not_valid');
    return {
      consent: { id: pending.consentId, status, validUntil: pending.validUntil },
      tokens: tokenSetFrom(grant, this.nowMs()),
      psuIpAddress,
      lastSyncedAt: null,
    };
  }

  /** TBC only issues tokens once the PSU approved, so a status that can't be read is taken as valid. */
  private async consentStatusAfterAuthorisation(consentId: string, psuIpAddress: string): Promise<string> {
    try {
      return await this.client.getConsentStatus(consentId, psuIpAddress);
    } catch (error) {
      if (!isTbcError(error)) throw error;
      logBankError(error);
      return 'valid';
    }
  }

  private failureReason(error: unknown): string {
    if (error instanceof AuthorisationFailure) {
      if (isTbcError(error.cause)) logBankError(error.cause);
      return error.reason;
    }
    console.error('[openbanking] completing the bank connection failed', error);
    return 'internal_error';
  }

  // MARK: Reading

  /** The session's bank data: cached for a few minutes, read from TBC when stale or when `refresh` is set. */
  async snapshot(session: Session, options: SnapshotOptions = {}): Promise<BankSnapshot | null> {
    const state = readBankState(session);
    if (!state.connection) return null;
    const connection = this.withPsuAddress(session, state.connection, options.psuIpAddress);
    if (!options.refresh && state.cache && this.nowMs() - state.cache.cachedAt < snapshotTtlMs) return state.cache.snapshot;

    const running = this.inFlight.get(session);
    if (running) return running;
    const reading: Promise<BankSnapshot> = this.sync(session, connection).finally(() => {
      if (this.inFlight.get(session) === reading) this.inFlight.delete(session);
    });
    this.inFlight.set(session, reading);
    return reading;
  }

  private withPsuAddress(session: Session, connection: BankConnection, psuIpAddress: string | undefined): BankConnection {
    if (!psuIpAddress || psuIpAddress === connection.psuIpAddress) return connection;
    const updated = { ...connection, psuIpAddress };
    updateBankState(session, { connection: updated });
    return updated;
  }

  private async sync(session: Session, connection: BankConnection): Promise<BankSnapshot> {
    try {
      const { snapshot, connection: used } = await this.readWithRenewal(session, connection);
      this.updateIfCurrent(session, used, {
        connection: { ...used, lastSyncedAt: snapshot.fetchedAt },
        cache: { snapshot, cachedAt: this.nowMs() },
      });
      return snapshot;
    } catch (error) {
      throw this.syncFailure(session, connection, error);
    }
  }

  private async readWithRenewal(
    session: Session,
    connection: BankConnection,
  ): Promise<{ snapshot: BankSnapshot; connection: BankConnection }> {
    let current = isAccessTokenExpired(connection.tokens, this.nowMs()) ? await this.renew(session, connection) : connection;
    try {
      return { snapshot: await this.readSnapshot(current), connection: current };
    } catch (error) {
      if (!isAccessTokenRejected(error)) throw error;
      // TBC expired the token before the time it announced: renew once and read again.
      current = await this.renew(session, current);
      return { snapshot: await this.readSnapshot(current), connection: current };
    }
  }

  private async readSnapshot(connection: BankConnection): Promise<BankSnapshot> {
    const now = this.now();
    const credentials = {
      accessToken: connection.tokens.accessToken,
      consentId: connection.consent.id,
      psuIpAddress: connection.psuIpAddress,
    };
    const raw = await fetchBankData(this.client, credentials, toIsoDate(addDays(now, -this.tbc.historyDays)));
    return {
      source: this.source,
      bank: 'TBC Bank',
      consent: connection.consent,
      ...normalizeBankData(raw, now),
      fetchedAt: now.toISOString(),
    };
  }

  private async renew(session: Session, connection: BankConnection): Promise<BankConnection> {
    const renewed = { ...connection, tokens: await this.renewTokens(connection.tokens) };
    this.updateIfCurrent(session, connection, { connection: renewed });
    return renewed;
  }

  private async renewTokens(tokens: TokenSet): Promise<TokenSet> {
    const refreshToken = usableRefreshToken(tokens, this.nowMs());
    if (!refreshToken) throw new ConnectionExpired('the refresh token has expired');
    try {
      return tokenSetFrom(await this.client.refreshAccessToken(refreshToken), this.nowMs(), tokens);
    } catch (error) {
      // A 4xx from the token endpoint: TBC no longer accepts the refresh token (consent ended or revoked).
      if (error instanceof TbcApiError && error.status < 500) throw new ConnectionExpired(error.message, { cause: error });
      throw error;
    }
  }

  private syncFailure(session: Session, connection: BankConnection, error: unknown): unknown {
    if (error instanceof ConnectionExpired || isConsentRejected(error) || isAccessTokenRejected(error)) {
      console.warn(`[openbanking] dropping the TBC connection: ${describe(error)}`);
      this.updateIfCurrent(session, connection, { connection: null, cache: null });
      return new HttpError(401, 'not_connected', 'The TBC connection has expired or was revoked. Connect the bank again.');
    }
    return this.toHttpError(error);
  }

  // MARK: Disconnecting

  /** Forgets the connection and deletes the consent at TBC. */
  async disconnect(session: Session, psuIpAddress: string): Promise<void> {
    const { connection } = readBankState(session);
    clearBankState(session);
    this.inFlight.delete(session);
    if (connection) await this.deleteConsentAtBank({ ...connection, psuIpAddress });
  }

  /** Best effort: without the forgotten tokens Algi can't read the account anyway, so a failure is only logged. */
  private async deleteConsentAtBank(connection: BankConnection): Promise<void> {
    try {
      const tokens = isAccessTokenExpired(connection.tokens, this.nowMs())
        ? await this.renewTokens(connection.tokens)
        : connection.tokens;
      await this.client.deleteConsent({
        accessToken: tokens.accessToken,
        consentId: connection.consent.id,
        psuIpAddress: connection.psuIpAddress,
      });
    } catch (error) {
      console.warn(`[openbanking] could not delete the consent at TBC: ${describe(error)}`);
    }
  }

  // MARK: Helpers

  /** Writes only while `expected` is still the session's connection: a disconnect or reconnect may have happened. */
  private updateIfCurrent(session: Session, expected: BankConnection, changes: Partial<BankSessionState>): void {
    if (readBankState(session).connection?.consent.id === expected.consent.id) updateBankState(session, changes);
  }

  private async callTbc<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown): unknown {
    if (!isTbcError(error)) return error;
    logBankError(error);
    return bankErrorToHttp(error);
  }

  private nowMs(): number {
    return this.now().getTime();
  }
}

/** TBC error messages carry the operation, status, code and trace ID only: no tokens or personal data. */
function logBankError(error: TbcError): void {
  console.warn(`[openbanking] ${error.message}`);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
