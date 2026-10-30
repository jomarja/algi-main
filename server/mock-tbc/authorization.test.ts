import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config.ts';
import type { TbcProblem, TbcTokenResponse } from '../openbanking/tbc-types.ts';
import type { AuthorisedConsent } from './mock-bank-driver.ts';
import { MockBankDriver, consentBody, testPsuIpAddress } from './mock-bank-driver.ts';
import type { MockResponse } from './responses.ts';

const config = loadConfig({ TBC_MODE: 'mock', PORT: '8787', PUBLIC_BASE_URL: 'http://localhost:5173' });
const startOfTest = Date.parse('2026-10-29T09:00:00Z');
const validUntil = '2027-01-27';
const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const challenge = createHash('sha256').update(verifier).digest('base64url');

let nowMs = startOfTest;
let bank: MockBankDriver;

beforeEach(() => {
  nowMs = startOfTest;
  bank = new MockBankDriver(config, () => new Date(nowMs));
});

function body<T>(response: MockResponse): T {
  return JSON.parse(response.body) as T;
}

function createConsentWith(headers: Record<string, string>, payload: unknown): MockResponse {
  return bank.send('POST', `${config.tbc.apiBaseUrl}/v1/consents`, headers, JSON.stringify(payload));
}

function consentStatus(consentId: string): string | undefined {
  const response = bank.send('GET', `${config.tbc.apiBaseUrl}/v1/consents/${consentId}/status`, {
    'x-request-id': 'request-1',
    'psu-ip-address': testPsuIpAddress,
  });
  return body<{ consentStatus?: string }>(response).consentStatus;
}

/** Follows authorize to the consent screen and approves, returning the authorization code. */
function approve(consentId: string): string {
  return bank.authoriseInBrowser(bank.authorizeUrl(consentId, challenge), 'approve').get('code') ?? '';
}

function accounts(consent: AuthorisedConsent, headers: Record<string, string> = {}): MockResponse {
  return bank.send('GET', `${config.tbc.apiBaseUrl}/v1/accounts?withBalance=true`, { ...bank.aisHeaders(consent), ...headers });
}

describe('mock consents', () => {
  it('creates a consent the way TBC answers the OAuth approach', () => {
    const response = createConsentWith(bank.consentHeaders(), consentBody(validUntil));

    const created = body<{ consentStatus: string; consentId: string; _links: Record<string, { href: string }> }>(response);
    expect(response.status).toBe(201);
    expect(response.headers['ASPSP-SCA-Approach']).toBe('REDIRECT');
    expect(created.consentStatus).toBe('received');
    expect(created._links.scaOAuth.href).toBe('http://localhost:5173/mock-tbc/.well-known/oauth-authorization-server');
    expect(created._links.status.href).toBe(`/mock-tbc/0.8/v1/consents/${created.consentId}/status`);
    expect(consentStatus(created.consentId)).toBe('received');
  });

  it('echoes the X-Request-ID', () => {
    const headers = bank.consentHeaders();

    expect(createConsentWith(headers, consentBody(validUntil)).headers['X-Request-ID']).toBe(headers['x-request-id']);
  });

  it.each(['x-request-id', 'psu-ip-address', 'tpp-redirect-uri'])('requires the %s header', (header) => {
    const headers = bank.consentHeaders();
    delete headers[header];

    const response = createConsentWith(headers, consentBody(validUntil));

    expect(response.status).toBe(400);
    expect(body<TbcProblem>(response).code).toBe('FORMAT_ERROR');
  });

  it('rejects a TPP-Redirect-URI that is not registered', () => {
    const response = createConsentWith({ ...bank.consentHeaders(), 'tpp-redirect-uri': 'https://elsewhere.example/cb' }, consentBody(validUntil));

    expect(response.status).toBe(400);
  });

  it("rejects a past validUntil with TBC's message", () => {
    const response = createConsentWith(bank.consentHeaders(), consentBody('2026-10-28'));

    expect(response.status).toBe(400);
    expect(body<TbcProblem>(response)).toMatchObject({
      code: 'FORMAT_ERROR',
      status: 400,
      detail: 'ValidUntil parameter is invalid, please check the date.',
      instance: '/v1/consents',
      type: 'https://developers.tbcbank.ge/docs/error-type-400',
    });
  });

  it('rejects other invalid consent bodies', () => {
    const invalid = [{ ...consentBody(validUntil), frequencyPerDay: 5 }, { ...consentBody(validUntil), access: null }, { validUntil }, ['not', 'an', 'object']];

    for (const payload of invalid) {
      expect(createConsentWith(bank.consentHeaders(), payload).status).toBe(400);
    }
  });

  it('shortens a consent longer than 90 days to 90 days', () => {
    const consentId = bank.createConsent('2027-12-31');

    const screen = bank.send('GET', bank.send('GET', bank.authorizeUrl(consentId, challenge)).headers.Location);

    expect(screen.body).toContain('2027-01-27');
  });

  it('answers 403 CONSENT_UNKNOWN for the status of an unknown consent', () => {
    const response = bank.send('GET', `${config.tbc.apiBaseUrl}/v1/consents/unknown/status`, { 'x-request-id': 'r', 'psu-ip-address': testPsuIpAddress });

    expect(response.status).toBe(403);
    expect(body<TbcProblem>(response)).toMatchObject({ code: 'CONSENT_UNKNOWN', detail: 'Consent not found with this Id: unknown' });
  });

  it('terminates a consent deleted by the TPP and revokes its tokens', () => {
    const consent = bank.authorisedConsent(validUntil);

    const deleted = bank.send('DELETE', `${config.tbc.apiBaseUrl}/v1/consents/${consent.consentId}`, bank.aisHeaders(consent));

    expect(deleted.status).toBe(204);
    expect(consentStatus(consent.consentId)).toBe('terminatedByTpp');
    expect(body<TbcProblem>(accounts(consent)).code).toBe('TOKEN_INVALID');
    expect(bank.token({ grant_type: 'refresh_token', refresh_token: consent.refreshToken }).status).toBe(400);
  });
});

describe('mock authorize endpoint', () => {
  it('publishes its metadata', () => {
    const metadata = body<Record<string, unknown>>(bank.send('GET', '/mock-tbc/.well-known/oauth-authorization-server'));

    expect(metadata).toMatchObject({
      issuer: 'http://localhost:5173/mock-tbc',
      authorization_endpoint: 'http://localhost:5173/mock-tbc/psd2/openbanking/oauth/authorize',
      token_endpoint: config.tbc.tokenUrl,
      token_endpoint_auth_methods_supported: ['tls_client_auth'],
      tls_client_certificate_bound_access_tokens: true,
    });
  });

  it('shows the bilingual simulation consent screen', () => {
    const consentId = bank.createConsent(validUntil);

    const screen = bank.send('GET', bank.send('GET', bank.authorizeUrl(consentId, challenge, { ui_locales: 'ka' })).headers.Location);

    expect(screen.status).toBe(200);
    expect(screen.headers['Content-Type']).toContain('text/html');
    expect(screen.headers['Content-Security-Policy']).toContain("form-action 'self' http://localhost:5173");
    expect(screen.body).toContain('lang="ka"');
    expect(screen.body).toContain('Simulation');
    expect(screen.body).toContain('სიმულაცია');
    expect(screen.body).toContain('value="approve"');
    expect(screen.body).toContain('value="decline"');
  });

  it.each([
    ['client_id', 'someone-else'],
    ['redirect_uri', 'https://attacker.example/callback'],
  ])('shows an error page instead of redirecting for a wrong %s', (param, value) => {
    const consentId = bank.createConsent(validUntil);

    const response = bank.send('GET', bank.authorizeUrl(consentId, challenge, { [param]: value }));

    expect(response.status).toBe(400);
    expect(response.headers.Location).toBeUndefined();
  });

  it.each([
    [{ code_challenge: '' }, 'invalid_request'],
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ nonce: '' }, 'invalid_request'],
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ scope: 'AIS:unknown-consent' }, 'invalid_scope'],
    [{ scope: 'PIS:payment' }, 'invalid_scope'],
  ])('redirects back with an error for %o', (overrides, error) => {
    const consentId = bank.createConsent(validUntil);

    const response = bank.send('GET', bank.authorizeUrl(consentId, challenge, overrides));

    const callback = new URL(response.headers.Location);
    expect(response.status).toBe(302);
    expect(`${callback.origin}${callback.pathname}`).toBe(config.tbc.redirectUri);
    expect(callback.searchParams.get('error')).toBe(error);
    expect(callback.searchParams.get('state')).toBe('state-1');
  });

  it('redirects with the code and state on approval, and marks the consent valid', () => {
    const consentId = bank.createConsent(validUntil);

    const callback = bank.authoriseInBrowser(bank.authorizeUrl(consentId, challenge), 'approve');

    expect(callback.get('code')).toMatch(/^[\w-]{40,}$/);
    expect(callback.get('state')).toBe('state-1');
    expect(consentStatus(consentId)).toBe('valid');
  });

  it('redirects with access_denied on decline, rejects the consent, and does not authorise it again', () => {
    const consentId = bank.createConsent(validUntil);

    const callback = bank.authoriseInBrowser(bank.authorizeUrl(consentId, challenge), 'decline');

    expect(callback.get('error')).toBe('access_denied');
    expect(callback.get('state')).toBe('state-1');
    expect(callback.get('code')).toBeNull();
    expect(consentStatus(consentId)).toBe('rejected');
    expect(new URL(bank.send('GET', bank.authorizeUrl(consentId, challenge)).headers.Location).searchParams.get('error')).toBe('invalid_scope');
  });

  it('expires an unused consent screen', () => {
    const consentId = bank.createConsent(validUntil);
    const screenUrl = bank.send('GET', bank.authorizeUrl(consentId, challenge)).headers.Location;
    nowMs += 16 * 60_000;

    expect(bank.send('GET', screenUrl).status).toBe(404);
  });
});

describe('mock token endpoint', () => {
  function exchange(code: string, overrides: Record<string, string> = {}): MockResponse {
    return bank.token({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: config.tbc.redirectUri, ...overrides });
  }

  it("issues tokens shaped like TBC's example", () => {
    const consentId = bank.createConsent(validUntil);

    const response = exchange(approve(consentId));

    expect(response.status).toBe(200);
    expect(body<TbcTokenResponse>(response)).toMatchObject({
      token_type: 'Bearer',
      scope: `AIS:${consentId}`,
      expires_in: 3599,
      refresh_token_expires_in: '7775999',
      refresh_count: 0,
      issued_at: String(startOfTest),
    });
  });

  it('accepts each code once', () => {
    const code = approve(bank.createConsent(validUntil));

    expect(exchange(code).status).toBe(200);
    expect(body<TbcProblem>(exchange(code))).toMatchObject({ error: 'invalid_request', error_description: 'Invalid Authorization Code' });
  });

  it('checks the PKCE verifier', () => {
    const response = exchange(approve(bank.createConsent(validUntil)), { code_verifier: 'another-verifier-of-sufficient-length-1234567' });

    expect(response.status).toBe(400);
    expect(body<TbcProblem>(response).error).toBe('invalid_request');
  });

  it('checks the redirect URI', () => {
    expect(exchange(approve(bank.createConsent(validUntil)), { redirect_uri: 'https://elsewhere.example/cb' }).status).toBe(400);
  });

  it('expires codes', () => {
    const code = approve(bank.createConsent(validUntil));
    nowMs += 6 * 60_000;

    expect(exchange(code).status).toBe(400);
  });

  it('checks the client ID and the grant type', () => {
    const code = approve(bank.createConsent(validUntil));

    expect(body<TbcProblem>(exchange(code, { client_id: 'someone-else' })).error).toBe('invalid_client');
    expect(body<TbcProblem>(bank.token({ grant_type: 'client_credentials' })).error).toBe('unsupported_grant_type');
  });

  it('refreshes: a new access token, the same refresh token, one more refresh counted', () => {
    const consent = bank.authorisedConsent(validUntil);

    const refreshed = body<TbcTokenResponse>(bank.token({ grant_type: 'refresh_token', refresh_token: consent.refreshToken }));

    expect(refreshed.access_token).not.toBe(consent.accessToken);
    expect(refreshed.refresh_token).toBe(consent.refreshToken);
    expect(refreshed.refresh_count).toBe(1);
  });

  it('refuses to refresh once the consent has expired', () => {
    const consent = bank.authorisedConsent(validUntil);
    nowMs += 91 * 24 * 60 * 60_000;

    expect(body<TbcProblem>(bank.token({ grant_type: 'refresh_token', refresh_token: consent.refreshToken })).error).toBe('invalid_grant');
    expect(consentStatus(consent.consentId)).toBe('expired');
  });
});

describe('mock resource access', () => {
  it('serves account data to a valid token for its consent', () => {
    const consent = bank.authorisedConsent(validUntil);

    expect(accounts(consent).status).toBe(200);
  });

  it('answers 401 TOKEN_INVALID without a known token', () => {
    const consent = bank.authorisedConsent(validUntil);

    const response = accounts(consent, { authorization: 'Bearer forged' });

    expect(response.status).toBe(401);
    expect(body<TbcProblem>(response)).toMatchObject({ code: 'TOKEN_INVALID', instance: '/v1/accounts' });
  });

  it('answers 401 TOKEN_EXPIRED after an hour', () => {
    const consent = bank.authorisedConsent(validUntil);
    nowMs += 60 * 60_000;

    expect(body<TbcProblem>(accounts(consent))).toMatchObject({ code: 'TOKEN_EXPIRED', title: 'Access Token is expired.', status: 401 });
  });

  it('answers 401 CONSENT_INVALID to a token of another consent', () => {
    const first = bank.authorisedConsent(validUntil);
    const second = bank.authorisedConsent(validUntil);

    expect(body<TbcProblem>(accounts(first, { 'consent-id': second.consentId })).code).toBe('CONSENT_INVALID');
  });

  it('answers 404 CONSENT_UNKNOWN for an unknown consent', () => {
    const consent = bank.authorisedConsent(validUntil);

    const response = accounts(consent, { 'consent-id': 'c9161b2e-46d0-4891-8114-2767253d4510' });

    expect(response.status).toBe(404);
    expect(body<TbcProblem>(response).detail).toBe('Consent not found with this Id: c9161b2e-46d0-4891-8114-2767253d4510');
  });

  it.each(['x-request-id', 'psu-ip-address', 'consent-id'])('answers 400 FORMAT_ERROR without %s', (header) => {
    const consent = bank.authorisedConsent(validUntil);
    const headers = bank.aisHeaders(consent);
    delete headers[header];

    const response = bank.send('GET', `${config.tbc.apiBaseUrl}/v1/accounts`, headers);

    expect(response.status).toBe(400);
    expect(body<TbcProblem>(response).code).toBe('FORMAT_ERROR');
  });

  it("expects the loans service's consentId header rather than Consent-ID", () => {
    const consent = bank.authorisedConsent(validUntil);
    const { 'consent-id': consentId, ...headers } = bank.aisHeaders(consent);

    expect(bank.send('GET', '/mock-tbc/v2/loans', { ...headers, 'consent-id': consentId }).status).toBe(400);
    expect(bank.send('GET', '/mock-tbc/v2/loans', { ...headers, consentId }).status).toBe(200);
  });

  it('answers 404 for an endpoint TBC does not have', () => {
    expect(bank.send('GET', '/mock-tbc/0.8/v1/payments').status).toBe(404);
  });
});
