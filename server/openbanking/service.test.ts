import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BankTransaction, CurrencyCode } from '../../shared/bank.ts';
import { loadConfig } from '../config.ts';
import { HttpError, Session } from '../http.ts';
import { MockBankDriver, testPsuIpAddress } from '../mock-tbc/mock-bank-driver.ts';
import { BankService } from './service.ts';
import { readBankState } from './session-state.ts';
import { TbcClient } from './tbc-client.ts';
import type { HttpTransport, TransportRequest } from './transport.ts';

// The whole flow against the built-in mock bank, in-process: consent, the PSU's approval, tokens, snapshots.

const config = loadConfig({ TBC_MODE: 'mock', PORT: '8787', PUBLIC_BASE_URL: 'http://localhost:5173' });
/** The iOS app's illustrative rates (CurrencyConverter.sample), to compare totals in lari. */
const gelPerUnit: Record<CurrencyCode, number> = { GEL: 1, USD: 2.7, EUR: 2.92 };
const startOfTest = Date.parse('2026-10-29T09:00:00Z'); // SampleData.referenceDate

let nowMs = startOfTest;
const now = () => new Date(nowMs);

interface Harness {
  service: BankService;
  session: Session;
  bank: MockBankDriver;
  sent: TransportRequest[];
  /** Answers the next request whose URL contains `urlPart` with an error status. */
  failNext(urlPart: string, status: number): void;
}

function setUp(): Harness {
  const bank = new MockBankDriver(config, now);
  const toBank = bank.transport();
  const sent: TransportRequest[] = [];
  const failures: Array<{ urlPart: string; status: number }> = [];
  const transport: HttpTransport = {
    async send(request) {
      sent.push(request);
      const failure = failures.findIndex(({ urlPart }) => request.url.includes(urlPart));
      if (failure === -1) return toBank.send(request);
      const [{ status }] = failures.splice(failure, 1);
      return { status, headers: {}, body: JSON.stringify({ code: '', title: 'Internal Error', status }) };
    },
  };
  return {
    service: new BankService({ tbc: config.tbc, client: new TbcClient(config.tbc, transport), now }),
    session: new Session('session-1'),
    bank,
    sent,
    failNext: (urlPart, status) => failures.push({ urlPart, status }),
  };
}

async function connect({ service, session, bank }: Harness): Promise<void> {
  const { authorizeUrl } = await service.connect(session, 'en', testPsuIpAddress);
  const callback = bank.authoriseInBrowser(authorizeUrl, 'approve');
  expect(await service.completeAuthorisation(session, callback, testPsuIpAddress)).toBe('/?bank=connected');
}

function inGel(transaction: BankTransaction): number {
  return Math.round(transaction.amount * gelPerUnit[transaction.currency] * 100) / 100;
}

function spending(transactions: BankTransaction[], month: string, category?: string): number {
  const total = transactions
    .filter((tx) => tx.direction === 'expense' && tx.bookingDate.startsWith(month) && (!category || tx.category === category))
    .reduce((sum, tx) => sum + inGel(tx), 0);
  return Math.round(total * 100) / 100;
}

beforeEach(() => {
  nowMs = startOfTest;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('connecting a bank', () => {
  it('creates the consent and sends the PSU to the authorize page with PKCE', async () => {
    const { service, session } = setUp();

    const { authorizeUrl } = await service.connect(session, 'ka', testPsuIpAddress);

    const url = new URL(authorizeUrl);
    const pending = readBankState(session).pending;
    expect(`${url.origin}${url.pathname}`).toBe('http://localhost:5173/mock-tbc/psd2/openbanking/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe(`AIS:${pending?.consentId}`);
    expect(url.searchParams.get('state')).toBe(pending?.state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('ui_locales')).toBe('ka');
    expect(authorizeUrl).not.toContain(pending?.codeVerifier ?? 'missing');
  });

  it('connects after the PSU approves, keeping the tokens on the server', async () => {
    const harness = setUp();

    await connect(harness);

    const status = harness.service.status(harness.session);
    const { connection, pending } = readBankState(harness.session);
    expect(status).toEqual({
      connected: true,
      source: 'mock',
      consent: { id: connection?.consent.id, status: 'valid', validUntil: '2027-01-27' },
      lastSyncedAt: null,
    });
    expect(pending).toBeNull();
    expect(JSON.stringify(status)).not.toContain(connection?.tokens.accessToken ?? 'missing');
  });

  it('reports the PSU declining as access_denied', async () => {
    const { service, session, bank } = setUp();
    const { authorizeUrl } = await service.connect(session, 'en', testPsuIpAddress);

    const callback = bank.authoriseInBrowser(authorizeUrl, 'decline');

    expect(await service.completeAuthorisation(session, callback, testPsuIpAddress)).toBe('/?bank=error&reason=access_denied');
    expect(service.status(session).connected).toBe(false);
  });

  it('rejects a callback whose state does not match, and does not accept the code afterwards', async () => {
    const { service, session, bank } = setUp();
    const { authorizeUrl } = await service.connect(session, 'en', testPsuIpAddress);
    const callback = bank.authoriseInBrowser(authorizeUrl, 'approve');
    const forged = new URLSearchParams(callback);
    forged.set('state', 'forged');

    expect(await service.completeAuthorisation(session, forged, testPsuIpAddress)).toBe('/?bank=error&reason=state_mismatch');
    expect(await service.completeAuthorisation(session, callback, testPsuIpAddress)).toBe('/?bank=error&reason=session_expired');
  });

  it('expires an authorisation left pending too long', async () => {
    const { service, session, bank } = setUp();
    const { authorizeUrl } = await service.connect(session, 'en', testPsuIpAddress);
    const callback = bank.authoriseInBrowser(authorizeUrl, 'approve');
    nowMs += 16 * 60_000;

    expect(await service.completeAuthorisation(session, callback, testPsuIpAddress)).toBe('/?bank=error&reason=session_expired');
  });

  it('reports a failed code exchange', async () => {
    const harness = setUp();
    const { authorizeUrl } = await harness.service.connect(harness.session, 'en', testPsuIpAddress);
    const callback = harness.bank.authoriseInBrowser(authorizeUrl, 'approve');
    harness.failNext('/oauth/token', 500);

    expect(await harness.service.completeAuthorisation(harness.session, callback, testPsuIpAddress)).toBe(
      '/?bank=error&reason=token_exchange_failed',
    );
  });

  it('turns a TBC failure while creating the consent into a clear error', async () => {
    const harness = setUp();
    harness.failNext('/v1/consents', 500);

    await expect(harness.service.connect(harness.session, 'en', testPsuIpAddress)).rejects.toMatchObject({
      status: 502,
      code: 'bank_unavailable',
    });
  });
});

describe('reading the snapshot', () => {
  it('is null while no bank is connected', async () => {
    const { service, session } = setUp();

    await expect(service.snapshot(session)).resolves.toBeNull();
    expect(service.status(session)).toEqual({ connected: false, source: 'mock', consent: null, lastSyncedAt: null });
  });

  it("shows the mock persona's accounts and loan as the iOS app does", async () => {
    const harness = setUp();
    await connect(harness);

    const snapshot = await harness.service.snapshot(harness.session, { psuIpAddress: testPsuIpAddress });

    expect(snapshot?.source).toBe('mock');
    expect(snapshot?.bank).toBe('TBC Bank');
    expect(snapshot?.accounts.map(({ name, kind, currency, balance }) => ({ name, kind, currency, balance }))).toEqual([
      { name: 'Everyday', kind: 'current', currency: 'GEL', balance: 2486.4 },
      { name: 'Everyday', kind: 'current', currency: 'USD', balance: 0 },
      { name: 'Everyday', kind: 'current', currency: 'EUR', balance: 0 },
      { name: 'Savings', kind: 'savings', currency: 'GEL', balance: 14850 },
    ]);
    expect(snapshot?.loans).toEqual([
      expect.objectContaining({
        name: 'Consumer loan',
        currency: 'GEL',
        outstanding: 4944.2,
        monthlyPayment: 243.44,
        annualRatePercent: 20,
        remainingMonths: 25,
        nextPaymentDate: '2026-11-05',
      }),
    ]);
    expect(harness.service.status(harness.session).lastSyncedAt).toBe(snapshot?.fetchedAt);
  });

  it("matches SampleData's October and history, with own transfers and card duplicates left out", async () => {
    const harness = setUp();
    await connect(harness);

    const transactions = (await harness.service.snapshot(harness.session))?.transactions ?? [];

    const october = transactions.filter((tx) => tx.bookingDate.startsWith('2026-10'));
    expect(october.filter((tx) => tx.direction === 'expense' && tx.status === 'booked')).toHaveLength(25);
    expect(spending(transactions, '2026-10')).toBeCloseTo(2158.97, 2);
    expect(spending(transactions, '2026-10', 'housing')).toBe(850);
    expect(spending(transactions, '2026-10', 'debt')).toBe(243.44);
    expect(spending(transactions, '2026-10', 'groceries')).toBeCloseTo(296.05, 2);
    expect(spending(transactions, '2026-10', 'foodDelivery')).toBeCloseTo(185, 2);
    expect(spending(transactions, '2026-10', 'subscriptions')).toBeCloseTo(47.13, 2);
    expect(spending(transactions, '2026-09')).toBeCloseTo(2240, 2);
    expect(spending(transactions, '2026-09', 'foodDelivery')).toBeCloseTo(142, 2);
    expect(spending(transactions, '2026-08', 'foodDelivery')).toBeCloseTo(118, 2);

    expect(october.filter((tx) => tx.direction === 'income' && tx.status === 'booked').map((tx) => tx.amount)).toEqual([3400]);
    expect(october.filter((tx) => tx.status === 'pending').map(({ amount, bookingDate }) => ({ amount, bookingDate }))).toEqual([
      { amount: 250, bookingDate: '2026-10-29' },
      { amount: 59.9, bookingDate: '2026-10-29' },
    ]);
    expect(transactions.some((tx) => tx.merchant === 'Nino Nadiradze')).toBe(false);
    expect(new Set(transactions.map((tx) => tx.id)).size).toBe(transactions.length);
    expect(transactions.some((tx) => tx.id.startsWith('card_'))).toBe(false);
  });

  it('follows the paging links of long reports', async () => {
    const harness = setUp();
    await connect(harness);

    await harness.service.snapshot(harness.session);

    const gelPages = harness.sent.filter((request) => request.url.includes('/accounts/0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a02/transactions'));
    expect(gelPages).toHaveLength(2);
    expect(gelPages[1].url).toContain('page=2');
  });

  it('sends the AIS headers on every data call, and never a token to the browser', async () => {
    const harness = setUp();
    await connect(harness);

    const snapshot = await harness.service.snapshot(harness.session);

    const { connection } = readBankState(harness.session);
    const accountCalls = harness.sent.filter((request) => request.url.includes('/0.8/v1/accounts'));
    expect(accountCalls.length).toBeGreaterThan(0);
    for (const request of accountCalls) {
      expect(request.headers).toMatchObject({
        Authorization: `Bearer ${connection?.tokens.accessToken}`,
        'Consent-ID': connection?.consent.id,
        'PSU-IP-Address': testPsuIpAddress,
      });
      expect(request.headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(JSON.stringify(snapshot)).not.toContain(connection?.tokens.accessToken ?? 'missing');
    expect(JSON.stringify(snapshot)).not.toContain(connection?.tokens.refreshToken ?? 'missing');
  });

  it('serves the cached snapshot for a few minutes, and reads again on refresh', async () => {
    const harness = setUp();
    await connect(harness);
    const first = await harness.service.snapshot(harness.session);
    const requestsAfterFirstRead = harness.sent.length;

    nowMs += 60_000;
    expect(await harness.service.snapshot(harness.session)).toBe(first);
    expect(harness.sent).toHaveLength(requestsAfterFirstRead);

    const refreshed = await harness.service.snapshot(harness.session, { refresh: true });
    expect(refreshed).not.toBe(first);
    expect(harness.sent.length).toBeGreaterThan(requestsAfterFirstRead);
  });

  it('reads once when the app and the coach ask at the same time', async () => {
    const harness = setUp();
    await connect(harness);

    const [fromApp, fromCoach] = await Promise.all([harness.service.snapshot(harness.session), harness.service.snapshot(harness.session)]);

    expect(fromApp).toBe(fromCoach);
    expect(harness.sent.filter((request) => request.url.includes('/v1/accounts?withBalance=true'))).toHaveLength(1);
  });

  it('renews an expired access token with the refresh token', async () => {
    const harness = setUp();
    await connect(harness);
    const tokensBefore = readBankState(harness.session).connection?.tokens;

    nowMs += 2 * 60 * 60_000;
    const snapshot = await harness.service.snapshot(harness.session);

    const tokenCalls = harness.sent.filter((request) => request.url === config.tbc.tokenUrl);
    expect(snapshot?.accounts.length).toBeGreaterThan(0);
    expect(new URLSearchParams(tokenCalls.at(-1)?.body).get('grant_type')).toBe('refresh_token');
    expect(readBankState(harness.session).connection?.tokens.accessToken).not.toBe(tokensBefore?.accessToken);
  });

  it('drops the connection when TBC no longer accepts the consent', async () => {
    const harness = setUp();
    await connect(harness);
    const connection = readBankState(harness.session).connection;
    // The consent ends at the bank, outside Algi.
    harness.bank.send('DELETE', `${config.tbc.apiBaseUrl}/v1/consents/${connection?.consent.id}`, {
      authorization: `Bearer ${connection?.tokens.accessToken}`,
      'x-request-id': 'request-1',
      'psu-ip-address': testPsuIpAddress,
    });

    const error = await harness.service.snapshot(harness.session, { refresh: true }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401, code: 'not_connected' });
    expect(harness.service.status(harness.session).connected).toBe(false);
  });

  it('keeps the connection when TBC is briefly unavailable', async () => {
    const harness = setUp();
    await connect(harness);
    harness.failNext('/0.8/v1/accounts?withBalance', 500);

    await expect(harness.service.snapshot(harness.session)).rejects.toMatchObject({ status: 502, code: 'bank_unavailable' });
    expect(harness.service.status(harness.session).connected).toBe(true);
    await expect(harness.service.snapshot(harness.session)).resolves.not.toBeNull();
  });
});

describe('disconnecting', () => {
  it('deletes the consent at TBC and forgets the tokens', async () => {
    const harness = setUp();
    await connect(harness);
    const consentId = readBankState(harness.session).connection?.consent.id;

    await harness.service.disconnect(harness.session, testPsuIpAddress);

    const status = harness.bank.send('GET', `${config.tbc.apiBaseUrl}/v1/consents/${consentId}/status`, {
      'x-request-id': 'request-1',
      'psu-ip-address': testPsuIpAddress,
    });
    expect(JSON.parse(status.body)).toEqual({ consentStatus: 'terminatedByTpp' });
    expect(readBankState(harness.session)).toEqual({ pending: null, connection: null, cache: null });
    await expect(harness.service.snapshot(harness.session)).resolves.toBeNull();
  });

  it('still forgets the connection when TBC cannot delete the consent', async () => {
    const harness = setUp();
    await connect(harness);
    harness.failNext('/v1/consents/', 500);

    await harness.service.disconnect(harness.session, testPsuIpAddress);

    expect(harness.service.status(harness.session).connected).toBe(false);
  });
});
