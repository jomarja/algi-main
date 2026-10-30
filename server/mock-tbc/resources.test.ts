import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config.ts';
import type {
  TbcAccountsResponse,
  TbcCardAccountsResponse,
  TbcCardTransactionsResponse,
  TbcLoanBalancesResponse,
  TbcLoansResponse,
  TbcProblem,
  TbcSavingsResponse,
  TbcTransactionsResponse,
} from '../openbanking/tbc-types.ts';
import type { AuthorisedConsent } from './mock-bank-driver.ts';
import { MockBankDriver } from './mock-bank-driver.ts';
import { mockAccountIds } from './persona.ts';
import type { MockResponse } from './responses.ts';

const config = loadConfig({ TBC_MODE: 'mock', PORT: '8787', PUBLIC_BASE_URL: 'http://localhost:5173' });
const api = config.tbc.apiBaseUrl;

let bank: MockBankDriver;
let consent: AuthorisedConsent;

beforeEach(() => {
  bank = new MockBankDriver(config, () => new Date('2026-10-29T09:00:00Z'));
  consent = bank.authorisedConsent('2027-01-27');
});

function get<T>(path: string): { response: MockResponse; body: T } {
  const { 'consent-id': consentId, ...headers } = bank.aisHeaders(consent);
  const url = path.startsWith('/v2/') ? `${config.tbc.productsBaseUrl}${path}` : `${api}${path}`;
  const consentHeader: Record<string, string> = path.startsWith('/v2/') ? { consentid: consentId } : { 'consent-id': consentId };
  const response = bank.send('GET', url, { ...headers, ...consentHeader });
  return { response, body: JSON.parse(response.body) as T };
}

function transactionsPath(accountId: string, query = 'dateFrom=2026-07-01&bookingStatus=both'): string {
  return `/v1/accounts/${accountId}/transactions?${query}`;
}

describe('mock accounts', () => {
  it('lists the aggregation account and its sub-accounts, with balances only when asked', () => {
    const withBalances = get<TbcAccountsResponse>('/v1/accounts?withBalance=true').body.accounts ?? [];
    const without = get<TbcAccountsResponse>('/v1/accounts').body.accounts ?? [];

    expect(withBalances.map((account) => account.currency)).toEqual(['XXX', 'GEL', 'USD', 'EUR']);
    expect(withBalances[1]._links?.aggregationAccount?.href).toBe(`/mock-tbc/0.8/v1/accounts/${mockAccountIds.everyday}`);
    expect(withBalances[1].balances).toContainEqual(expect.objectContaining({ balanceType: 'interimBooked', balanceAmount: { currency: 'GEL', amount: '2486.40' } }));
    expect(without.every((account) => account.balances === undefined)).toBe(true);
  });

  it('reads one account balances, and 404 for an account outside the consent', () => {
    expect(get<{ balances: unknown[] }>(`/v1/accounts/${mockAccountIds.everydayGel}/balances`).body.balances).toHaveLength(2);
    expect(get<TbcProblem>('/v1/accounts/someone-elses/balances').response.status).toBe(404);
  });
});

describe('mock transaction reports', () => {
  it('pages booked transactions by 50, with a next link while more follow and pending items on the first page', () => {
    const first = get<TbcTransactionsResponse>(transactionsPath(mockAccountIds.everydayGel)).body.transactions;
    const nextHref = first?._links?.next?.href ?? '';
    const second = get<TbcTransactionsResponse>(nextHref.replace('/mock-tbc/0.8', '')).body.transactions;

    expect(first?.booked).toHaveLength(50);
    expect(first?.pending).toHaveLength(2);
    expect(first?._links?.account?.href).toBe(`/mock-tbc/0.8/v1/accounts/${mockAccountIds.everydayGel}`);
    expect(nextHref).toBe(`/mock-tbc/0.8${transactionsPath(mockAccountIds.everydayGel)}&page=2`);
    expect(second?.booked).toHaveLength(45);
    expect(second?.pending).toEqual([]);
    expect(second?._links?.next).toBeUndefined();
  });

  it('books USD and EUR payments on their sub-accounts', () => {
    const usd = get<TbcTransactionsResponse>(transactionsPath(mockAccountIds.everydayUsd)).body;

    expect(usd.account).toEqual({ iban: 'GE82TB7724936515100001', currency: 'USD' });
    expect(usd.transactions?.booked?.every((tx) => tx.transactionAmount?.currency === 'USD')).toBe(true);
    expect(usd.transactions?.booked?.map((tx) => tx.creditorName)).toContain('Netflix');
  });

  it('filters by date and booking status', () => {
    const october = get<TbcTransactionsResponse>(transactionsPath(mockAccountIds.everydayGel, 'dateFrom=2026-10-01&dateTo=2026-10-31&bookingStatus=booked'))
      .body.transactions;
    const pendingOnly = get<TbcTransactionsResponse>(transactionsPath(mockAccountIds.everydayGel, 'bookingStatus=pending')).body.transactions;

    expect(october?.booked?.every((tx) => (tx.bookingDate ?? '').startsWith('2026-10'))).toBe(true);
    expect(october?.booked).toHaveLength(24);
    expect(october?.pending).toEqual([]);
    expect(pendingOnly?.booked).toEqual([]);
    expect(pendingOnly?.pending?.map((tx) => tx.transactionAmount?.amount)).toEqual(['250.00', '59.90']);
  });

  it.each([
    ['dateFrom=2026-07-01', 'bookingStatus'],
    ['dateFrom=2026-13-01&bookingStatus=both', 'dateFrom'],
    ['bookingStatus=both&page=0', 'page'],
  ])('rejects %s with FORMAT_ERROR', (query, mentioned) => {
    const { response, body } = get<TbcProblem>(transactionsPath(mockAccountIds.everydayGel, query));

    expect(response.status).toBe(400);
    expect(body.code).toBe('FORMAT_ERROR');
    expect(body.detail).toContain(mentioned);
  });

  it('reports the debit card, mirroring the account, with its card payments', () => {
    const cards = get<TbcCardAccountsResponse>('/v1/card-accounts?withBalance=true').body.cardAccounts ?? [];
    const report = get<TbcCardTransactionsResponse>(`/v1/card-accounts/${mockAccountIds.card}/transactions?bookingStatus=both`).body;

    expect(cards).toEqual([expect.objectContaining({ resourceId: mockAccountIds.card, maskedPan: '427638******4821', product: 'VISA', currency: 'XXX' })]);
    expect(report.cardAccount).toEqual({ maskedPan: '427638******4821', currency: 'XXX' });
    expect(report.cardTransactions?.booked?.[0]).toMatchObject({ cardTransactionId: expect.stringMatching(/^card_/), transactionDetails: expect.any(String) });
    expect(report.cardTransactions?._links?.cardAccount?.href).toBe(`/mock-tbc/0.8/v1/card-accounts/${mockAccountIds.card}`);
  });
});

describe('mock loans and savings', () => {
  it('lists the consumer loan with numeric balances', () => {
    const [loan] = get<TbcLoansResponse>('/v2/loans').body.accounts ?? [];

    expect(loan).toMatchObject({
      resourceId: mockAccountIds.loan,
      currency: 'GEL',
      status: 'Enabled',
      product: 'Consumer loan',
      interest: { rate: { percentage: 20 } },
      relatedDates: { contractStartDate: '2024-11-05T00:00:00', contractEndDate: '2028-11-05T00:00:00' },
    });
    expect(loan.balances?.[0]).toMatchObject({ balanceType: 'InterimBooked', balanceAmount: { currency: 'GEL', amount: 4944.2 } });
  });

  it('reads loan balances, and 404 for an unknown loan', () => {
    expect(get<TbcLoanBalancesResponse>(`/v2/loans/${mockAccountIds.loan}/balances`).body.balances).toHaveLength(1);
    expect(get<TbcProblem>('/v2/loans/unknown/balances').response.status).toBe(404);
  });

  it('lists the savings account like the savings example', () => {
    const [savings] = get<TbcSavingsResponse>('/v2/savings?withBalance=true').body.accounts ?? [];

    expect(savings).toMatchObject({
      resourceId: mockAccountIds.savings,
      product: 'Savings',
      currency: 'GEL',
      cashAccountType: 'SVGS',
      balances: [{ balanceAmount: { currency: 'GEL', amount: '14850.00' }, balanceType: 'OpeningBooked', referenceDate: '2026-10-29' }],
    });
  });
});
