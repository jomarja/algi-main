import type { RawBankData } from './normalize.ts';
import { reportableAccounts } from './normalize.ts';
import type { AisCredentials, TbcClient } from './tbc-client.ts';
import type { TbcLoan } from './tbc-types.ts';

/** The TBC reads a snapshot needs. */
export type BankDataReader = Pick<
  TbcClient,
  | 'listAccounts'
  | 'getAccountBalances'
  | 'listAccountTransactions'
  | 'listCardAccounts'
  | 'listCardAccountTransactions'
  | 'listLoans'
  | 'getLoanBalances'
  | 'listSavings'
>;

/**
 * Reads everything for one consent: accounts with balances and transactions since `dateFrom`, card accounts
 * and their transactions, then loans and savings when TBC offers them for the consent.
 */
export async function fetchBankData(reader: BankDataReader, credentials: AisCredentials, dateFrom: string): Promise<RawBankData> {
  const [accounts, cards, loans, savings] = await Promise.all([
    fetchAccounts(reader, credentials, dateFrom),
    fetchCards(reader, credentials, dateFrom),
    fetchLoans(reader, credentials),
    reader.listSavings(credentials),
  ]);
  return { accounts, cards, loans, savings };
}

async function fetchAccounts(reader: BankDataReader, credentials: AisCredentials, dateFrom: string): Promise<RawBankData['accounts']> {
  const accounts = reportableAccounts(await reader.listAccounts(credentials));
  return Promise.all(
    accounts.map(async (account) => {
      const [balances, transactions] = await Promise.all([
        // `withBalance` is optional for TBC: read the balances separately when the list came without them.
        account.balances?.length ? account.balances : reader.getAccountBalances(credentials, account.resourceId),
        reader.listAccountTransactions(credentials, account.resourceId, dateFrom),
      ]);
      return { account: { ...account, balances }, transactions };
    }),
  );
}

async function fetchCards(reader: BankDataReader, credentials: AisCredentials, dateFrom: string): Promise<RawBankData['cards']> {
  const cards = await reader.listCardAccounts(credentials);
  return Promise.all(
    cards.map(async (card) => ({
      card,
      transactions: card.resourceId
        ? await reader.listCardAccountTransactions(credentials, card.resourceId, dateFrom)
        : { booked: [], pending: [] },
    })),
  );
}

async function fetchLoans(reader: BankDataReader, credentials: AisCredentials): Promise<TbcLoan[]> {
  const loans = await reader.listLoans(credentials);
  return Promise.all(
    loans.map(async (loan) =>
      loan.balances?.length || !loan.resourceId ? loan : { ...loan, balances: await reader.getLoanBalances(credentials, loan.resourceId) },
    ),
  );
}
