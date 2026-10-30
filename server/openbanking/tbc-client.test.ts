import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.ts';
import { TbcApiError, TbcProtocolError } from './errors.ts';
import type { AisCredentials } from './tbc-client.ts';
import { TbcClient } from './tbc-client.ts';
import type { HttpTransport, TransportRequest, TransportResponse } from './transport.ts';

const tbc = loadConfig({
  TBC_MODE: 'sandbox',
  TBC_CLIENT_ID: 'PSDGE-NBG-TESTGE11',
  TBC_REDIRECT_URI: 'https://algi.example/api/bank/callback',
}).tbc;

const credentials: AisCredentials = { accessToken: 'access-1', consentId: 'consent-1', psuIpAddress: '203.0.113.7' };

/** Answers requests in order from `responses`, recording what was sent. */
class ScriptedTransport implements HttpTransport {
  readonly sent: TransportRequest[] = [];
  private readonly responses: Array<TransportResponse | Error>;

  constructor(...responses: Array<TransportResponse | Error>) {
    this.responses = responses;
  }

  async send(request: TransportRequest): Promise<TransportResponse> {
    this.sent.push(request);
    const next = this.responses.shift();
    if (!next) throw new Error(`unexpected request ${request.method} ${request.url}`);
    if (next instanceof Error) throw next;
    return next;
  }
}

function ok(body: unknown, status = 200): TransportResponse {
  return { status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

function failure(status: number, body: unknown): TransportResponse {
  return { status, headers: { 'content-type': 'application/problem+json' }, body: JSON.stringify(body) };
}

function clientWith(transport: HttpTransport): TbcClient {
  let requestNumber = 0;
  return new TbcClient(tbc, transport, () => `request-${++requestNumber}`);
}

const consentCreatedExample = {
  consentStatus: 'received',
  consentId: 'c79ad1fb-8d01-44fc-b602-9ce471033952',
  _links: { scaOAuth: { href: 'https://test-api.tbcbank.ge/.well-known/oauth-authorization-server' } },
};

const consentUnknownExample = {
  code: 'CONSENT_UNKNOWN',
  traceId: '00-88e0f2509e1d5ad73d99dee283010f18-bdcf39859de601a7-01',
  type: 'https://developers.tbcbank.ge/docs/error-type-404',
  title: 'Consent not found',
  status: 404,
  detail: 'Consent not found with this Id: c9161b2e-46d0-4891-8114-2767253d4510',
  instance: '/v1/accounts',
};

describe('TbcClient consents', () => {
  it("creates a bank-offered, recurring consent as in TBC's example", async () => {
    const transport = new ScriptedTransport(ok(consentCreatedExample, 201));

    const consent = await clientWith(transport).createConsent({ validUntil: '2027-01-27', psuIpAddress: '203.0.113.7', language: 'ka' });

    expect(consent).toEqual({ consentId: 'c79ad1fb-8d01-44fc-b602-9ce471033952', consentStatus: 'received' });
    const [request] = transport.sent;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://test-openbanking.tbcbank.ge/0.8/v1/consents');
    expect(JSON.parse(request.body ?? '')).toEqual({
      access: { Accounts: [], Balances: [], Transactions: [] },
      recurringIndicator: true,
      validUntil: '2027-01-27',
      frequencyPerDay: 4,
      combinedServiceIndicator: false,
    });
  });

  it('sends the PSD2 headers of the consent request', async () => {
    const transport = new ScriptedTransport(ok(consentCreatedExample, 201));

    await clientWith(transport).createConsent({ validUntil: '2027-01-27', psuIpAddress: '203.0.113.7', language: 'en' });

    const { headers, body } = transport.sent[0];
    expect(headers).toEqual({
      Accept: 'application/json',
      'X-Request-ID': 'request-1',
      'PSU-IP-Address': '203.0.113.7',
      'TPP-Redirect-URI': 'https://algi.example/api/bank/callback',
      'Accept-Language': 'en',
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(body ?? '')),
    });
  });

  it('gives every request its own X-Request-ID, a UUID by default', async () => {
    const transport = new ScriptedTransport(ok({ consentStatus: 'valid' }), ok({ consentStatus: 'valid' }));
    const client = new TbcClient(tbc, transport);

    await client.getConsentStatus('consent-1', '203.0.113.7');
    await client.getConsentStatus('consent-1', '203.0.113.7');

    const [first, second] = transport.sent.map((request) => request.headers['X-Request-ID']);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it('reads the consent status', async () => {
    const transport = new ScriptedTransport(ok({ consentStatus: 'valid' }));

    await expect(clientWith(transport).getConsentStatus('consent-1', '203.0.113.7')).resolves.toBe('valid');
    expect(transport.sent[0].url).toBe('https://test-openbanking.tbcbank.ge/0.8/v1/consents/consent-1/status');
    expect(transport.sent[0].headers['PSU-IP-Address']).toBe('203.0.113.7');
  });

  it('deletes the consent with the bearer token', async () => {
    const transport = new ScriptedTransport({ status: 204, headers: {}, body: '' });

    await clientWith(transport).deleteConsent(credentials);

    expect(transport.sent[0]).toMatchObject({
      method: 'DELETE',
      url: 'https://test-openbanking.tbcbank.ge/0.8/v1/consents/consent-1',
      headers: { Authorization: 'Bearer access-1', 'PSU-IP-Address': '203.0.113.7' },
    });
  });

  it('rejects a consent response without a consent ID', async () => {
    const transport = new ScriptedTransport(ok({ consentStatus: 'received' }, 201));

    await expect(clientWith(transport).createConsent({ validUntil: '2027-01-27', psuIpAddress: '1.1.1.1', language: 'en' })).rejects.toBeInstanceOf(
      TbcProtocolError,
    );
  });
});

describe('TbcClient tokens', () => {
  const tokenExample = { access_token: 'ffODwEVU5sD9RADdEWEYUQNijrcE', token_type: 'Bearer', refresh_token: 'qjfH', expires_in: 3599 };

  it('exchanges the authorization code with the PKCE verifier, form-encoded', async () => {
    const transport = new ScriptedTransport(ok(tokenExample));

    const grant = await clientWith(transport).exchangeAuthorizationCode('code-1', 'verifier-1');

    expect(grant.access_token).toBe('ffODwEVU5sD9RADdEWEYUQNijrcE');
    const [request] = transport.sent;
    expect(request.url).toBe('https://test-openbanking.tbcbank.ge/openbanking/oauth/token');
    expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
      client_id: 'PSDGE-NBG-TESTGE11',
      grant_type: 'authorization_code',
      code: 'code-1',
      code_verifier: 'verifier-1',
      redirect_uri: 'https://algi.example/api/bank/callback',
    });
  });

  it('refreshes with the refresh_token grant', async () => {
    const transport = new ScriptedTransport(ok(tokenExample));

    await clientWith(transport).refreshAccessToken('refresh-1');

    expect(Object.fromEntries(new URLSearchParams(transport.sent[0].body))).toEqual({
      client_id: 'PSDGE-NBG-TESTGE11',
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
    });
  });

  it("maps TBC's OAuth error body", async () => {
    const transport = new ScriptedTransport(
      failure(400, {
        error: 'invalid_request',
        error_uri: 'https://developers.tbcbank.ge/docs/error-type-400',
        error_description: 'Invalid Authorization Code',
        systemCode: 'System code for problem is psd2_oauth.400.001',
      }),
    );

    const error = await clientWith(transport).exchangeAuthorizationCode('expired', 'verifier').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TbcApiError);
    expect(error).toMatchObject({ status: 400, code: 'invalid_request', operation: 'exchangeAuthorizationCode' });
  });

  it('rejects a token response without an access token', async () => {
    const transport = new ScriptedTransport(ok({ token_type: 'Bearer' }));

    await expect(clientWith(transport).refreshAccessToken('refresh-1')).rejects.toBeInstanceOf(TbcProtocolError);
  });
});

describe('TbcClient account data', () => {
  it('reads accounts with balances, sending the AIS headers', async () => {
    const transport = new ScriptedTransport(ok({ accounts: [{ resourceId: 'acc-1', currency: 'GEL' }] }));

    const accounts = await clientWith(transport).listAccounts(credentials);

    expect(accounts).toEqual([{ resourceId: 'acc-1', currency: 'GEL' }]);
    expect(transport.sent[0].url).toBe('https://test-openbanking.tbcbank.ge/0.8/v1/accounts?withBalance=true');
    expect(transport.sent[0].headers).toEqual({
      Accept: 'application/json',
      'X-Request-ID': 'request-1',
      Authorization: 'Bearer access-1',
      'Consent-ID': 'consent-1',
      'PSU-IP-Address': '203.0.113.7',
    });
  });

  it('reads one account balances', async () => {
    const balances = [{ balanceType: 'interimBooked', balanceAmount: { currency: 'GEL', amount: '30.00' } }];
    const transport = new ScriptedTransport(ok({ account: { iban: 'GE01TB0203040506070809' }, balances }));

    await expect(clientWith(transport).getAccountBalances(credentials, 'acc/1')).resolves.toEqual(balances);
    expect(transport.sent[0].url).toBe('https://test-openbanking.tbcbank.ge/0.8/v1/accounts/acc%2F1/balances');
  });

  it('follows _links.next until the last page and merges booked and pending items', async () => {
    const transport = new ScriptedTransport(
      ok({
        transactions: {
          booked: [{ transactionId: 'b1' }],
          pending: [{ transactionId: 'p1' }],
          _links: { next: { href: '/0.8/v1/accounts/acc-1/transactions?dateFrom=2026-07-01&bookingStatus=both&page=2' } },
        },
      }),
      ok({ transactions: { booked: [{ transactionId: 'b2' }], pending: [], _links: {} } }),
    );

    const lists = await clientWith(transport).listAccountTransactions(credentials, 'acc-1', '2026-07-01');

    expect(lists).toEqual({ booked: [{ transactionId: 'b1' }, { transactionId: 'b2' }], pending: [{ transactionId: 'p1' }] });
    expect(transport.sent.map((request) => request.url)).toEqual([
      'https://test-openbanking.tbcbank.ge/0.8/v1/accounts/acc-1/transactions?dateFrom=2026-07-01&bookingStatus=both',
      'https://test-openbanking.tbcbank.ge/0.8/v1/accounts/acc-1/transactions?dateFrom=2026-07-01&bookingStatus=both&page=2',
    ]);
    expect(transport.sent[1].headers.Authorization).toBe('Bearer access-1');
  });

  it('reads card account transactions from the cardTransactions report', async () => {
    const transport = new ScriptedTransport(ok({ cardTransactions: { booked: [{ bookingDate: '2024-03-10' }], pending: [] } }));

    const lists = await clientWith(transport).listCardAccountTransactions(credentials, 'card-1', '2026-07-01');

    expect(lists.booked).toEqual([{ bookingDate: '2024-03-10' }]);
    expect(transport.sent[0].url).toBe('https://test-openbanking.tbcbank.ge/0.8/v1/card-accounts/card-1/transactions?dateFrom=2026-07-01&bookingStatus=both');
  });

  it('never follows a paging link to another host', async () => {
    const transport = new ScriptedTransport(
      ok({ transactions: { booked: [], pending: [], _links: { next: { href: 'https://attacker.example/steal' } } } }),
    );

    await expect(clientWith(transport).listAccountTransactions(credentials, 'acc-1', '2026-07-01')).rejects.toThrow(/another host/);
    expect(transport.sent).toHaveLength(1);
  });

  it('stops when a paging link repeats', async () => {
    const page = ok({ transactions: { booked: [], _links: { next: { href: '/0.8/v1/accounts/acc-1/transactions?page=2' } } } });
    const transport = new ScriptedTransport(page, page, page);

    await expect(clientWith(transport).listAccountTransactions(credentials, 'acc-1', '2026-07-01')).rejects.toThrow(/paging/);
  });
});

describe('TbcClient loans and savings', () => {
  it("sends the consent in the loans service's consentId header", async () => {
    const transport = new ScriptedTransport(ok({ accounts: [{ resourceId: 'loan-1' }] }));

    await expect(clientWith(transport).listLoans(credentials)).resolves.toEqual([{ resourceId: 'loan-1' }]);
    expect(transport.sent[0].url).toBe('https://test-openbanking.tbcbank.ge/v2/loans');
    expect(transport.sent[0].headers).toMatchObject({ Authorization: 'Bearer access-1', consentId: 'consent-1', 'PSU-IP-Address': '203.0.113.7' });
    expect(transport.sent[0].headers['Consent-ID']).toBeUndefined();
  });

  it('reads savings with balances', async () => {
    const transport = new ScriptedTransport(ok({ accounts: [{ resourceId: 'savings-1' }] }));

    await clientWith(transport).listSavings(credentials);

    expect(transport.sent[0].url).toBe('https://test-openbanking.tbcbank.ge/v2/savings?withBalance=true');
  });

  it.each([401, 403, 404])('treats %i on an optional product as "not offered"', async (status) => {
    const transport = new ScriptedTransport(failure(status, { code: 'CONSENT_INVALID', status }), failure(status, {}), failure(status, {}));
    const client = clientWith(transport);

    await expect(client.listLoans(credentials)).resolves.toEqual([]);
    await expect(client.getLoanBalances(credentials, 'loan-1')).resolves.toEqual([]);
    await expect(client.listSavings(credentials)).resolves.toEqual([]);
  });

  it('still fails when the products service is down', async () => {
    const transport = new ScriptedTransport(failure(500, { code: '', title: 'Internal Error', status: 500 }));

    await expect(clientWith(transport).listLoans(credentials)).rejects.toMatchObject({ status: 500, code: 'HTTP_500' });
  });
});

describe('TbcClient errors', () => {
  it("maps TBC's problem details to TbcApiError", async () => {
    const transport = new ScriptedTransport(failure(404, consentUnknownExample));

    const error = await clientWith(transport).listAccounts(credentials).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TbcApiError);
    expect(error).toMatchObject({
      operation: 'listAccounts',
      status: 404,
      code: 'CONSENT_UNKNOWN',
      traceId: '00-88e0f2509e1d5ad73d99dee283010f18-bdcf39859de601a7-01',
    });
    expect((error as Error).message).not.toContain('c9161b2e');
  });

  it('describes an error without a body by its status', async () => {
    const transport = new ScriptedTransport({ status: 502, headers: {}, body: '<html>Bad gateway</html>' });

    await expect(clientWith(transport).listAccounts(credentials)).rejects.toMatchObject({ status: 502, code: 'HTTP_502' });
  });

  it('reports a network failure as TbcProtocolError', async () => {
    const transport = new ScriptedTransport(new Error('connect ECONNREFUSED'));

    const error = await clientWith(transport).listAccounts(credentials).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TbcProtocolError);
    expect((error as Error).message).toContain('ECONNREFUSED');
  });

  it('reports a success that is not JSON as TbcProtocolError', async () => {
    const transport = new ScriptedTransport({ status: 200, headers: {}, body: 'OK' });

    await expect(clientWith(transport).listAccounts(credentials)).rejects.toBeInstanceOf(TbcProtocolError);
  });
});
