import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config.ts';
import type { TbcConsentResponse, TbcTokenResponse } from '../openbanking/tbc-types.ts';
import type { HttpTransport } from '../openbanking/transport.ts';
import type { MockResponse } from './responses.ts';
import { mockRequestFrom } from './responses.ts';
import type { MockTbcHandler } from './routes.ts';
import { createMockTbcHandler } from './routes.ts';

/**
 * Drives the mock bank in-process, for tests: as the server's TBC client (`transport`) and as the PSU's browser
 * (`authoriseInBrowser`). Plain requests, independent of the openbanking client.
 */

export interface AuthorisedConsent {
  consentId: string;
  accessToken: string;
  refreshToken: string;
}

export const testPsuIpAddress = '203.0.113.7';

export class MockBankDriver {
  readonly config: ServerConfig;
  private readonly handle: MockTbcHandler;

  constructor(config: ServerConfig, now: () => Date) {
    this.config = config;
    this.handle = createMockTbcHandler(config, now);
  }

  send(method: string, url: string, headers: Record<string, string> = {}, body = ''): MockResponse {
    return this.handle(mockRequestFrom(method, new URL(url, this.config.publicBaseUrl), headers, body));
  }

  /** Sends HTTP requests straight to the mock, as the loopback server would. */
  transport(): HttpTransport {
    return {
      send: async (request) => {
        const response = this.send(request.method, request.url, request.headers, request.body ?? '');
        const headers = Object.fromEntries(Object.entries(response.headers).map(([name, value]) => [name.toLowerCase(), value]));
        return { ...response, headers };
      },
    };
  }

  /** Opens the authorize URL, follows the redirect to the consent screen, decides, and returns the callback query. */
  authoriseInBrowser(authorizeUrl: string, decision: 'approve' | 'decline'): URLSearchParams {
    const consentScreenUrl = redirectLocation(this.send('GET', authorizeUrl));
    const screen = this.send('GET', consentScreenUrl);
    if (screen.status !== 200) throw new Error(`The consent screen answered ${screen.status}`);
    const sessionId = new URL(consentScreenUrl, this.config.publicBaseUrl).searchParams.get('sessionid') ?? '';
    const form = new URLSearchParams({ sessionid: sessionId, decision }).toString();
    const callback = redirectLocation(this.send('POST', consentScreenUrl, { 'content-type': 'application/x-www-form-urlencoded' }, form));
    return new URL(callback).searchParams;
  }

  createConsent(validUntil: string): string {
    const response = this.send('POST', `${this.config.tbc.apiBaseUrl}/v1/consents`, this.consentHeaders(), JSON.stringify(consentBody(validUntil)));
    const consentId = (JSON.parse(response.body) as TbcConsentResponse).consentId;
    if (response.status !== 201 || !consentId) throw new Error(`Creating a consent answered ${response.status}`);
    return consentId;
  }

  authorizeUrl(consentId: string, codeChallenge: string, overrides: Record<string, string> = {}): string {
    const url = new URL(`${this.config.tbc.authBaseUrl}/psd2/openbanking/oauth/authorize`);
    const params = {
      client_id: this.config.tbc.clientId,
      scope: `AIS:${consentId}`,
      response_type: 'code',
      redirect_uri: this.config.tbc.redirectUri,
      nonce: 'nonce-1',
      state: 'state-1',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ui_locales: 'en',
      ...overrides,
    };
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  }

  /** A consent the PSU approved, with the tokens of its authorization code. */
  authorisedConsent(validUntil: string): AuthorisedConsent {
    const consentId = this.createConsent(validUntil);
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const code = this.authoriseInBrowser(this.authorizeUrl(consentId, challenge), 'approve').get('code') ?? '';
    const response = this.token({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: this.config.tbc.redirectUri });
    const tokens = JSON.parse(response.body) as TbcTokenResponse;
    if (response.status !== 200 || !tokens.access_token || !tokens.refresh_token) throw new Error(`The token exchange answered ${response.status}`);
    return { consentId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
  }

  token(form: Record<string, string>): MockResponse {
    const body = new URLSearchParams({ client_id: this.config.tbc.clientId, ...form }).toString();
    return this.send('POST', this.config.tbc.tokenUrl, { 'content-type': 'application/x-www-form-urlencoded' }, body);
  }

  consentHeaders(): Record<string, string> {
    return { 'x-request-id': randomUUID(), 'psu-ip-address': testPsuIpAddress, 'tpp-redirect-uri': this.config.tbc.redirectUri };
  }

  aisHeaders(consent: AuthorisedConsent): Record<string, string> {
    return {
      authorization: `Bearer ${consent.accessToken}`,
      'consent-id': consent.consentId,
      'x-request-id': randomUUID(),
      'psu-ip-address': testPsuIpAddress,
    };
  }
}

export function consentBody(validUntil: string): Record<string, unknown> {
  return {
    access: { Accounts: [], Balances: [], Transactions: [] },
    recurringIndicator: true,
    validUntil,
    frequencyPerDay: 4,
    combinedServiceIndicator: false,
  };
}

function redirectLocation(response: MockResponse): string {
  if (response.status !== 302 || !response.headers.Location) throw new Error(`Expected a redirect, got ${response.status}`);
  return response.headers.Location;
}
