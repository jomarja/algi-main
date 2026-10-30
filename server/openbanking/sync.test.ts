import { describe, expect, it } from 'vitest';
import type { BankDataReader } from './sync.ts';
import { fetchBankData } from './sync.ts';
import type { AisCredentials } from './tbc-client.ts';
import type { TbcAccount, TbcBalance, TbcCardAccount, TbcLoan, TbcLoanBalance, TbcSavingsAccount } from './tbc-types.ts';

const credentials: AisCredentials = { accessToken: 'access-1', consentId: 'consent-1', psuIpAddress: '203.0.113.7' };
const gelBalance: TbcBalance[] = [{ balanceType: 'interimBooked', balanceAmount: { currency: 'GEL', amount: '30.00' } }];
const loanBalance: TbcLoanBalance[] = [{ balanceType: 'InterimBooked', balanceAmount: { currency: 'GEL', amount: 4944.2 } }];

interface ReaderData {
  accounts?: TbcAccount[];
  cards?: TbcCardAccount[];
  loans?: TbcLoan[];
  savings?: TbcSavingsAccount[];
}

/** A reader over fixed data that records which calls were made. */
function recordingReader(data: ReaderData): { reader: BankDataReader; calls: string[] } {
  const calls: string[] = [];
  const record = <T>(call: string, result: T): T => {
    calls.push(call);
    return result;
  };
  const reader: BankDataReader = {
    listAccounts: async () => record('listAccounts', data.accounts ?? []),
    getAccountBalances: async (_, id) => record(`getAccountBalances ${id}`, gelBalance),
    listAccountTransactions: async (_, id, dateFrom) => record(`listAccountTransactions ${id} ${dateFrom}`, { booked: [], pending: [] }),
    listCardAccounts: async () => record('listCardAccounts', data.cards ?? []),
    listCardAccountTransactions: async (_, id) => record(`listCardAccountTransactions ${id}`, { booked: [], pending: [] }),
    listLoans: async () => record('listLoans', data.loans ?? []),
    getLoanBalances: async (_, id) => record(`getLoanBalances ${id}`, loanBalance),
    listSavings: async () => record('listSavings', data.savings ?? []),
  };
  return { reader, calls };
}

describe('fetchBankData', () => {
  it('reads transactions of the sub-accounts only, not of their aggregation account', async () => {
    const { reader, calls } = recordingReader({
      accounts: [
        { resourceId: 'all', currency: 'XXX', balances: gelBalance },
        { resourceId: 'gel', currency: 'GEL', balances: gelBalance, _links: { aggregationAccount: { href: '/0.8/v1/accounts/all' } } },
      ],
    });

    const data = await fetchBankData(reader, credentials, '2026-07-01');

    expect(data.accounts.map(({ account }) => account.resourceId)).toEqual(['gel']);
    expect(calls).toContain('listAccountTransactions gel 2026-07-01');
    expect(calls).not.toContain('listAccountTransactions all 2026-07-01');
  });

  it('reads balances separately only for accounts listed without them', async () => {
    const { reader, calls } = recordingReader({
      accounts: [
        { resourceId: 'with', currency: 'GEL', balances: gelBalance },
        { resourceId: 'without', currency: 'GEL' },
      ],
    });

    const data = await fetchBankData(reader, credentials, '2026-07-01');

    expect(calls.filter((call) => call.startsWith('getAccountBalances'))).toEqual(['getAccountBalances without']);
    expect(data.accounts.find(({ account }) => account.resourceId === 'without')?.account.balances).toEqual(gelBalance);
  });

  it('reads the transactions of each addressable card account', async () => {
    const { reader, calls } = recordingReader({ cards: [{ resourceId: 'card-1', currency: 'XXX' }, { maskedPan: '123456******7890' }] });

    const data = await fetchBankData(reader, credentials, '2026-07-01');

    expect(calls.filter((call) => call.startsWith('listCardAccountTransactions'))).toEqual(['listCardAccountTransactions card-1']);
    expect(data.cards).toHaveLength(2);
    expect(data.cards[1].transactions).toEqual({ booked: [], pending: [] });
  });

  it('reads loan balances only for loans listed without them, and passes savings through', async () => {
    const savings: TbcSavingsAccount[] = [{ resourceId: 'savings-1', currency: 'GEL' }];
    const { reader, calls } = recordingReader({
      loans: [
        { resourceId: 'loan-with', currency: 'GEL', balances: loanBalance },
        { resourceId: 'loan-without', currency: 'GEL', balances: null },
      ],
      savings,
    });

    const data = await fetchBankData(reader, credentials, '2026-07-01');

    expect(calls.filter((call) => call.startsWith('getLoanBalances'))).toEqual(['getLoanBalances loan-without']);
    expect(data.loans.map((loan) => loan.balances)).toEqual([loanBalance, loanBalance]);
    expect(data.savings).toBe(savings);
  });
});
