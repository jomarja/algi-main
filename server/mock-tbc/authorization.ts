import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { TbcConfig } from '../config.ts';
import { addDays, parseIsoDate, toIsoDate } from '../openbanking/dates.ts';
import type {
  TbcAuthorizationServerMetadata,
  TbcConsentResponse,
  TbcConsentStatusResponse,
  TbcTokenResponse,
} from '../openbanking/tbc-types.ts';
import type { PageLanguage } from './consent-page.ts';
import { renderConsentPage, renderErrorPage } from './consent-page.ts';
import type { MockRequest, MockResponse } from './responses.ts';
import { formatError, html, instanceOf, json, mockTbcBasePath, oauthError, problem, redirectTo, withQuery } from './responses.ts';

/**
 * The mock's consents and OAuth authorization server, validating requests the way TBC documents: registered
 * client_id and redirect_uri, `AIS:<consentId>` scope, PKCE S256, single-use authorization codes, token expiry,
 * and access tokens bound to their consent. (Mutual TLS can't be imitated over the loopback.)
 */

type ConsentStatus = 'received' | 'rejected' | 'valid' | 'revokedByPsu' | 'expired' | 'terminatedByTpp';

interface MockConsent {
  id: string;
  status: ConsentStatus;
  validUntil: string;
  frequencyPerDay: number;
}

interface LoginSession {
  consentId: string;
  state: string;
  codeChallenge: string;
  language: PageLanguage;
  expiresAt: number;
}

interface IssuedCode {
  consentId: string;
  codeChallenge: string;
  expiresAt: number;
}

interface IssuedToken {
  consentId: string;
  issuedAt: number;
  expiresAt: number;
}

interface IssuedRefreshToken extends IssuedToken {
  refreshCount: number;
}

type ConsentTerms = Pick<MockConsent, 'validUntil' | 'frequencyPerDay'>;

/** "If date is provided more than 90 days, it will be decreased to 90 days" (TBC's ValidUntil). */
const maxConsentDays = 90;
const loginSessionTtlMs = 15 * 60_000;
const codeTtlMs = 5 * 60_000;
const accessTokenSeconds = 3599;
const refreshTokenSeconds = 7_775_999;
/** The mock's counterpart of TBC's login app, where authorize sends the PSU. */
const loginPagePath = `${mockTbcBasePath}/loginapp/session`;

export class MockAuthorizationServer {
  private readonly tbc: TbcConfig;
  private readonly now: () => Date;
  private readonly consents = new Map<string, MockConsent>();
  private readonly loginSessions = new Map<string, LoginSession>();
  private readonly codes = new Map<string, IssuedCode>();
  private readonly accessTokens = new Map<string, IssuedToken>();
  private readonly refreshTokens = new Map<string, IssuedRefreshToken>();

  constructor(tbc: TbcConfig, now: () => Date) {
    this.tbc = tbc;
    this.now = now;
  }

  // MARK: Consents

  createConsent(request: MockRequest): MockResponse {
    const instance = instanceOf(request);
    const missing = requireHeaders(request, ['x-request-id', 'psu-ip-address', 'tpp-redirect-uri'], instance);
    if (missing) return missing;
    if (request.headers['tpp-redirect-uri'] !== this.tbc.redirectUri) {
      return formatError('TPP-Redirect-URI is not the redirect URI registered for this client.', instance);
    }
    const terms = consentTerms(parseJsonObject(request.body), this.now());
    if (typeof terms === 'string') return formatError(terms, instance);

    const consent: MockConsent = { id: randomUUID(), status: 'received', ...terms };
    this.consents.set(consent.id, consent);
    const self = `${mockTbcBasePath}/0.8/v1/consents/${consent.id}`;
    const body: TbcConsentResponse = {
      consentStatus: consent.status,
      consentId: consent.id,
      _links: {
        scaOAuth: { href: `${this.tbc.authBaseUrl}/.well-known/oauth-authorization-server` },
        self: { href: self },
        status: { href: `${self}/status` },
        scaStatus: { href: `${self}/authorisations/${randomUUID()}` },
      },
    };
    return json(201, body, { 'ASPSP-SCA-Approach': 'REDIRECT' });
  }

  consentStatus(request: MockRequest, consentId: string): MockResponse {
    const instance = instanceOf(request);
    const missing = requireHeaders(request, ['x-request-id', 'psu-ip-address'], instance);
    if (missing) return missing;
    const consent = this.consents.get(consentId);
    if (!consent) return consentNotFound(403, consentId, instance);
    const body: TbcConsentStatusResponse = { consentStatus: this.statusOf(consent) };
    return json(200, body);
  }

  deleteConsent(request: MockRequest, consentId: string): MockResponse {
    const denied = this.authorizeResource(request, consentId);
    if (denied) return denied;
    this.updateConsent(consentId, 'terminatedByTpp');
    this.revokeTokens(consentId);
    return { status: 204, headers: {}, body: '' };
  }

  /** Access check for AIS endpoints (`Consent-ID` header) and the loans and savings service (`consentId` header). */
  authorizeResource(request: MockRequest, consentId: string | undefined): MockResponse | null {
    const instance = instanceOf(request);
    const missing = requireHeaders(request, ['x-request-id', 'psu-ip-address'], instance);
    if (missing) return missing;

    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1];
    const issued = token ? this.accessTokens.get(token) : undefined;
    if (!issued) {
      return problem(401, 'TOKEN_INVALID', 'Invalid Access Token', 'The access token is missing or unknown.', instance);
    }
    if (issued.expiresAt <= this.nowMs()) {
      return problem(401, 'TOKEN_EXPIRED', 'Access Token is expired.', 'Access Token is expired.', instance);
    }
    if (!consentId) return formatError('The consent ID header is missing.', instance);

    const consent = this.consents.get(consentId);
    if (!consent) return consentNotFound(404, consentId, instance);
    if (issued.consentId !== consentId) {
      return problem(401, 'CONSENT_INVALID', 'Invalid Access', 'The access token was not issued for this consent.', instance);
    }
    const status = this.statusOf(consent);
    if (status === 'expired') return problem(401, 'CONSENT_EXPIRED', 'Consent expired', 'The consent has expired.', instance);
    if (status !== 'valid') return problem(401, 'CONSENT_INVALID', 'Invalid Access', `The consent is ${status}.`, instance);
    return null;
  }

  // MARK: OAuth

  metadata(): MockResponse {
    const body: TbcAuthorizationServerMetadata = {
      issuer: this.tbc.authBaseUrl,
      authorization_endpoint: `${this.tbc.authBaseUrl}/psd2/openbanking/oauth/authorize`,
      token_endpoint: this.tbc.tokenUrl,
      token_endpoint_auth_methods_supported: ['tls_client_auth'],
      tls_client_certificate_bound_access_tokens: true,
      scopes_supported: ['openid', 'AIS:<consentId>'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      ui_locales_supported: ['en', 'ka'],
    };
    return json(200, body);
  }

  /** GET authorize: validates the request, then sends the browser to the login and consent screen. */
  authorize(request: MockRequest): MockResponse {
    const query = request.query;
    const language: PageLanguage = query.get('ui_locales') === 'ka' ? 'ka' : 'en';
    // RFC 6749 §4.1.2.1: with an unknown client or redirect URI, show an error instead of redirecting.
    if (query.get('client_id') !== this.tbc.clientId) {
      return html(400, renderErrorPage(language, { ka: 'უცნობი აპლიკაცია (client_id).', en: 'Unknown application (client_id).' }));
    }
    const redirectUri = this.tbc.redirectUri;
    if (query.get('redirect_uri') !== redirectUri) {
      const message = { ka: 'redirect_uri არ ემთხვევა რეგისტრირებულს.', en: 'redirect_uri is not the registered one.' };
      return html(400, renderErrorPage(language, message));
    }

    const state = query.get('state');
    const fail = (error: string, description: string) =>
      redirectTo(withQuery(redirectUri, { error, error_description: description, state }));
    if (query.get('response_type') !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported.');
    if (!state) return fail('invalid_request', 'state is required.');
    if (!query.get('nonce')) return fail('invalid_request', 'nonce is required.');
    const codeChallenge = query.get('code_challenge');
    if (!codeChallenge || query.get('code_challenge_method') !== 'S256') {
      return fail('invalid_request', 'PKCE with code_challenge_method=S256 is required.');
    }
    const consent = this.consentAwaitingAuthorisation(query.get('scope'));
    if (!consent) return fail('invalid_scope', 'scope must be AIS:<consentId> of a consent awaiting authorisation.');

    this.sweepExpired();
    const sessionId = randomToken(24);
    const expiresAt = this.nowMs() + loginSessionTtlMs;
    this.loginSessions.set(sessionId, { consentId: consent.id, state, codeChallenge, language, expiresAt });
    return redirectTo(`${loginPagePath}?sessionid=${sessionId}`);
  }

  loginPage(request: MockRequest, accounts: ReadonlyArray<{ name: string; detail: string }>): MockResponse {
    const sessionId = request.query.get('sessionid') ?? '';
    const session = this.activeLoginSession(sessionId);
    const consent = session && this.consents.get(session.consentId);
    if (!session || !consent) return sessionExpiredPage();
    const page = renderConsentPage({
      sessionId,
      language: session.language,
      clientId: this.tbc.clientId,
      validUntil: consent.validUntil,
      frequencyPerDay: consent.frequencyPerDay,
      accounts,
      formAction: loginPagePath,
    });
    const formTarget = new URL(this.tbc.redirectUri).origin;
    return html(200, page, {
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${formTarget}; frame-ancestors 'none'`,
    });
  }

  /** POST from the consent screen: Approve issues a code, Decline sends access_denied, both back to the TPP. */
  decide(request: MockRequest): MockResponse {
    const form = new URLSearchParams(request.body);
    const sessionId = form.get('sessionid') ?? '';
    const session = this.activeLoginSession(sessionId);
    if (!session) return sessionExpiredPage();
    this.loginSessions.delete(sessionId);

    const redirectBack = (params: Record<string, string>) =>
      redirectTo(withQuery(this.tbc.redirectUri, { ...params, state: session.state }));
    const consent = this.consents.get(session.consentId);
    if (!consent || consent.status !== 'received') {
      return redirectBack({ error: 'invalid_request', error_description: 'The consent is no longer awaiting authorisation.' });
    }
    if (form.get('decision') !== 'approve') {
      this.updateConsent(consent.id, 'rejected');
      return redirectBack({ error: 'access_denied', error_description: 'The customer declined the consent.' });
    }
    this.updateConsent(consent.id, 'valid');
    const code = randomToken(32);
    this.codes.set(code, { consentId: consent.id, codeChallenge: session.codeChallenge, expiresAt: this.nowMs() + codeTtlMs });
    return redirectBack({ code });
  }

  /** POST token: the authorization_code and refresh_token grants, form-encoded. */
  token(request: MockRequest): MockResponse {
    const form = new URLSearchParams(request.body);
    if (form.get('client_id') !== this.tbc.clientId) return oauthError(400, 'invalid_client', 'Unknown client_id.');
    switch (form.get('grant_type')) {
      case 'authorization_code':
        return this.exchangeCode(form);
      case 'refresh_token':
        return this.refresh(form);
      default:
        return oauthError(400, 'unsupported_grant_type', 'grant_type must be authorization_code or refresh_token.');
    }
  }

  private exchangeCode(form: URLSearchParams): MockResponse {
    const code = form.get('code') ?? '';
    const issued = this.codes.get(code);
    this.codes.delete(code); // single use, even when the exchange fails
    if (!issued || issued.expiresAt <= this.nowMs()) return oauthError(400, 'invalid_request', 'Invalid Authorization Code');
    if (form.get('redirect_uri') !== this.tbc.redirectUri) {
      return oauthError(400, 'invalid_request', 'redirect_uri does not match the authorization request.');
    }
    const verifier = form.get('code_verifier');
    if (!verifier || s256(verifier) !== issued.codeChallenge) {
      return oauthError(400, 'invalid_request', 'code_verifier does not match the code_challenge.');
    }
    const now = this.nowMs();
    const refreshToken = randomToken(24);
    const refresh: IssuedRefreshToken = {
      consentId: issued.consentId,
      issuedAt: now,
      expiresAt: now + refreshTokenSeconds * 1000,
      refreshCount: 0,
    };
    this.refreshTokens.set(refreshToken, refresh);
    return json(200, this.issueAccessToken(refreshToken, refresh));
  }

  private refresh(form: URLSearchParams): MockResponse {
    const refreshToken = form.get('refresh_token') ?? '';
    const issued = this.refreshTokens.get(refreshToken);
    if (!issued || issued.expiresAt <= this.nowMs()) return oauthError(400, 'invalid_grant', 'Invalid Refresh Token');
    const consent = this.consents.get(issued.consentId);
    if (!consent || this.statusOf(consent) !== 'valid') return oauthError(400, 'invalid_grant', 'The consent is no longer valid.');
    // As in TBC's example, a refresh keeps the refresh token and counts the refresh.
    const refreshed = { ...issued, refreshCount: issued.refreshCount + 1 };
    this.refreshTokens.set(refreshToken, refreshed);
    return json(200, this.issueAccessToken(refreshToken, refreshed));
  }

  private issueAccessToken(refreshToken: string, refresh: IssuedRefreshToken): TbcTokenResponse {
    const now = this.nowMs();
    const accessToken = randomToken(21);
    this.accessTokens.set(accessToken, { consentId: refresh.consentId, issuedAt: now, expiresAt: now + accessTokenSeconds * 1000 });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      refresh_token: refreshToken,
      refresh_token_issued_at: String(refresh.issuedAt),
      refresh_token_expires_in: String(Math.round((refresh.expiresAt - now) / 1000)),
      refresh_count: refresh.refreshCount,
      scope: `AIS:${refresh.consentId}`,
      issued_at: String(now),
      expires_in: accessTokenSeconds,
    };
  }

  // MARK: State

  /** A valid consent past its validUntil date is expired. */
  private statusOf(consent: MockConsent): ConsentStatus {
    if (consent.status === 'valid' && consent.validUntil < toIsoDate(this.now())) {
      this.updateConsent(consent.id, 'expired');
      return 'expired';
    }
    return consent.status;
  }

  private updateConsent(consentId: string, status: ConsentStatus): void {
    const consent = this.consents.get(consentId);
    if (consent) this.consents.set(consentId, { ...consent, status });
  }

  private consentAwaitingAuthorisation(scope: string | null): MockConsent | null {
    const consentId = /^AIS:(\S+)$/.exec(scope ?? '')?.[1];
    const consent = consentId ? this.consents.get(consentId) : undefined;
    return consent?.status === 'received' ? consent : null;
  }

  private activeLoginSession(sessionId: string): LoginSession | null {
    const session = this.loginSessions.get(sessionId);
    return session && session.expiresAt > this.nowMs() ? session : null;
  }

  private revokeTokens(consentId: string): void {
    for (const tokens of [this.accessTokens, this.refreshTokens]) {
      for (const [token, issued] of tokens) {
        if (issued.consentId === consentId) tokens.delete(token);
      }
    }
  }

  /** Forgets abandoned login sessions and unused codes. Tokens stay, so an expired one still gets TOKEN_EXPIRED. */
  private sweepExpired(): void {
    const now = this.nowMs();
    for (const expiring of [this.loginSessions, this.codes]) {
      for (const [key, entry] of expiring) {
        if (entry.expiresAt <= now) expiring.delete(key);
      }
    }
  }

  private nowMs(): number {
    return this.now().getTime();
  }
}

/** The consent's validUntil and frequency, or why the request body is invalid. */
function consentTerms(body: Record<string, unknown> | null, now: Date): ConsentTerms | string {
  if (!body) return 'The request body must be a JSON object.';
  if (typeof body.access !== 'object' || body.access === null) return 'access is required.';
  if (typeof body.recurringIndicator !== 'boolean') return 'recurringIndicator must be true or false.';
  if (typeof body.combinedServiceIndicator !== 'boolean') return 'combinedServiceIndicator must be true or false.';
  const frequencyPerDay = body.frequencyPerDay;
  if (typeof frequencyPerDay !== 'number' || !Number.isInteger(frequencyPerDay) || frequencyPerDay < 1 || frequencyPerDay > 4) {
    return 'frequencyPerDay must be a whole number from 1 to 4.';
  }
  const validUntil = parseIsoDate(typeof body.validUntil === 'string' ? body.validUntil : null);
  const today = toIsoDate(now);
  if (!validUntil || toIsoDate(validUntil) < today) return 'ValidUntil parameter is invalid, please check the date.';
  const latest = toIsoDate(addDays(now, maxConsentDays));
  return { validUntil: toIsoDate(validUntil) > latest ? latest : toIsoDate(validUntil), frequencyPerDay };
}

function requireHeaders(request: MockRequest, names: readonly string[], instance: string): MockResponse | null {
  const missing = names.find((name) => !request.headers[name]);
  return missing ? formatError(`The ${missing} header is required.`, instance) : null;
}

function consentNotFound(status: 403 | 404, consentId: string, instance: string): MockResponse {
  return problem(status, 'CONSENT_UNKNOWN', 'Consent not found', `Consent not found with this Id: ${consentId}`, instance);
}

function sessionExpiredPage(): MockResponse {
  return html(404, renderErrorPage('en', { ka: 'სესია ამოიწურა. დაიწყე თავიდან.', en: 'This session has expired. Start again.' }));
}

function parseJsonObject(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

function s256(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}
