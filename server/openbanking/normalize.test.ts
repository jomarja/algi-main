import { describe, expect, it } from 'vitest';
import type { RawBankData } from './normalize.ts';
import { annuityPayment, normalizeBankData, normalizeLoan, reportableAccounts } from './normalize.ts';
import type { TbcAccount, TbcBalance, TbcCardAccount, TbcCardTransaction, TbcLoan, TbcSavingsAccount, TbcTransaction, TbcTransactionLists } from './tbc-types.ts';

// Fixtures from TBC's AIS spec examples (GetPsd2AccountsResponse, GetBalanceResponse, GetPsd2TransactionsResponse,
// GetCardAccountsResponse, GetCardAccountTransactionsResponse) and its savings example.

const today = new Date('2026-10-30T10:00:00Z');
const iban = 'GE01TB0203040506070809';
const aggregationId = '761a7d98-3251-4e98-50fe-08dd818830c7';
const gelAccountId = '00f6360b-2720-4e64-50ff-08dd818830c7';
const usdAccountId = '20ab9546-f384-4950-5100-08dd818830c7';
const eurAccountId = 'ea7f2d3e-d371-407b-5101-08dd818830c7';

function balances(...entries: Array<[currency: string, booked: string, available: string]>): TbcBalance[] {
  return entries.flatMap(([currency, booked, available]) => [
    { balanceType: 'interimBooked', balanceAmount: { currency, amount: booked }, creditLimitIncluded: false, referenceDate: '2025-03-26' },
    { balanceType: 'interimAvailable', balanceAmount: { currency, amount: available }, creditLimitIncluded: false },
  ]);
}

function conceptAccount(resourceId: string, currency: string, accountBalances: TbcBalance[], aggregation?: string): TbcAccount {
  return {
    resourceId,
    iban,
    currency,
    ownerName: 'Owner Name 1',
    name: 'Owner Name 1',
    displayName: 'Concept',
    cashAccountType: 'CARD',
    status: 'enabled',
    bic: 'TBCBGE22',
    usage: 'PRIV',
    balances: accountBalances,
    _links: {
      balances: { href: `/0.8/v1/accounts/${resourceId}/balances` },
      transactions: { href: `/0.8/v1/accounts/${resourceId}/transactions` },
      account: { href: `/0.8/v1/accounts/${resourceId}` },
      ...(aggregation ? { aggregationAccount: { href: `/0.8/v1/accounts/${aggregation}` } } : {}),
    },
  };
}

const accountsExample: TbcAccount[] = [
  conceptAccount(aggregationId, 'XXX', balances(['GEL', '30.00', '30.00'], ['USD', '0.00', '0.00'], ['EUR', '0.33', '0.00'])),
  conceptAccount(gelAccountId, 'GEL', balances(['GEL', '30.00', '30.00']), aggregationId),
  conceptAccount(usdAccountId, 'USD', balances(['USD', '0.00', '0.00']), aggregationId),
  conceptAccount(eurAccountId, 'EUR', balances(['EUR', '0.33', '0.00']), aggregationId),
];

const balanceResponseExample: TbcBalance[] = [
  { balanceType: 'interimAvailable', balanceAmount: { currency: 'GEL', amount: '30.00' }, creditLimitIncluded: false },
  { balanceType: 'interimBooked', balanceAmount: { currency: 'GEL', amount: '30.00' }, referenceDate: '2025-03-26' },
  { balanceType: 'closingBooked', balanceAmount: { currency: 'GEL', amount: '-30.00' } },
  { balanceType: 'interimAvailable', balanceAmount: { currency: 'USD', amount: '0.00' } },
  { balanceType: 'interimBooked', balanceAmount: { currency: 'USD', amount: '0.00' } },
  { balanceType: 'interimAvailable', balanceAmount: { currency: 'EUR', amount: '0.00' } },
  { balanceType: 'interimBooked', balanceAmount: { currency: 'EUR', amount: '0.33' } },
];

const ownTransferExample: TbcTransaction = {
  transactionId: 'c_11223344556',
  entryReference: 'c_11223344556',
  debtorName: 'Debtor Name',
  debtorAccount: { iban: 'GE11TB1234567891234567', currency: 'GEL' },
  transactionAmount: { currency: 'GEL', amount: '250.00' },
  bookingDate: '2024-03-10',
  valueDate: '2024-03-10',
  remittanceInformationUnstructured: 'საკუთარ ანგარიშზე გადარიცხვა',
  additionalInformation: 'საკუთარ ანგარიშზე გადარიცხვა',
  proprietaryBankTransactionCode: 'GMI',
};

const personalTransferExample: TbcTransaction = {
  transactionId: 'd_11223344556',
  entryReference: 'd_11223344556',
  creditorName: 'Creditor Name',
  creditorAccount: { iban: 'GE11TB1234567891234567', currency: 'GEL' },
  transactionAmount: { currency: 'GEL', amount: '-50.00' },
  bookingDate: '2024-03-11',
  valueDate: '2024-03-11',
  remittanceInformationUnstructured: 'პირადი გადარიცხვა თიბისიში',
  additionalInformation: 'პირადი გადარიცხვა თიბისიში',
  proprietaryBankTransactionCode: 'GMB',
};

const cardAccountsExample: TbcCardAccount[] = [
  {
    resourceId: '0f92178b-a77f-45d8-50f5-08dd818830c7',
    maskedPan: '123456******7890',
    currency: 'XXX',
    ownerName: 'Owner Name 1',
    name: 'Owner Name 1',
    product: 'VISA',
    status: 'enabled',
    usage: 'PRIV',
    balances: balances(['GEL', '30.00', '30.00'], ['USD', '0.00', '0.00'], ['EUR', '0.33', '0.00']),
  },
  {
    resourceId: '67a95e02-f018-417e-50fa-08dd818830c7',
    maskedPan: '123456******7890',
    currency: 'XXX',
    ownerName: 'Owner Name 1',
    name: 'Owner Name 1',
    product: 'VISA',
    status: 'enabled',
    usage: 'PRIV',
    balances: balances(['GEL', '0.00', '0.00'], ['USD', '0.00', '0.00'], ['EUR', '0.20', '0.20']),
  },
];

const cardTransactionsExample: TbcCardTransaction[] = [
  { bookingDate: '2024-03-10', transactionAmount: { currency: 'GEL', amount: '250.00' }, proprietaryBankTransactionCode: 'GMI' },
  { bookingDate: '2024-03-11', transactionAmount: { currency: 'GEL', amount: '-50.00' }, proprietaryBankTransactionCode: 'GMB' },
];

const savingsExample: TbcSavingsAccount[] = [
  {
    resourceId: '456f48dh-f22f-444e-4fgr-15dcf9c6gc19',
    product: 'Term',
    currency: 'GEL',
    status: 'Active',
    period: 36,
    contractStartDate: '2024-01-03',
    ownerName: 'Saxeli Gvari',
    cashAccountType: 'SVGS',
    balances: [{ balanceAmount: { currency: 'GEL', amount: '442.64' }, balanceType: 'OpeningBooked', referenceDate: '2024-11-01' }],
  },
  {
    resourceId: '123asd36-g54h-555g-6fgr-16dcf6c9gc27',
    product: 'Term',
    currency: 'USD',
    status: 'Active',
    period: 24,
    contractStartDate: '2023-09-07',
    ownerName: 'Saxeli Gvari',
    cashAccountType: 'SVGS',
    balances: [{ balanceAmount: { currency: 'USD', amount: '1121.08' }, balanceType: 'OpeningBooked', referenceDate: '2024-11-01' }],
  },
];

function lists<T>(booked: T[], pending: T[] = []): TbcTransactionLists<T> {
  return { booked, pending };
}

function raw(data: Partial<RawBankData>): RawBankData {
  return { accounts: [], cards: [], loans: [], savings: [], ...data };
}

const noTransactions = lists<TbcTransaction>([]);

describe('reportableAccounts', () => {
  it('drops the multi-currency aggregation account when its per-currency sub-accounts are listed', () => {
    expect(reportableAccounts(accountsExample).map((account) => account.resourceId)).toEqual([gelAccountId, usdAccountId, eurAccountId]);
  });

  it('keeps an aggregation account listed without sub-accounts', () => {
    expect(reportableAccounts([accountsExample[0]]).map((account) => account.resourceId)).toEqual([aggregationId]);
  });

  it('drops accounts TBC cannot address, and deleted ones', () => {
    const available: TbcAccount = { iban: 'GE75TB7341367986493342', currency: 'GEL', displayName: 'Concept' };
    const deleted = { ...accountsExample[1], status: 'deleted' };

    expect(reportableAccounts([available, deleted])).toEqual([]);
  });
});

describe('normalizeBankData accounts', () => {
  it('reports each per-currency sub-account with its booked and available balance', () => {
    const accounts = reportableAccounts(accountsExample).map((account) => ({ account, transactions: noTransactions }));

    expect(normalizeBankData(raw({ accounts }), today).accounts).toEqual([
      { id: gelAccountId, iban, name: 'Concept', kind: 'current', currency: 'GEL', balance: 30, available: 30 },
      { id: usdAccountId, iban, name: 'Concept', kind: 'current', currency: 'USD', balance: 0, available: 0 },
      { id: eurAccountId, iban, name: 'Concept', kind: 'current', currency: 'EUR', balance: 0.33, available: 0 },
    ]);
  });

  it('splits a multi-currency account into the currencies that hold money', () => {
    const { accounts } = normalizeBankData(raw({ accounts: [{ account: accountsExample[0], transactions: noTransactions }] }), today);

    expect(accounts.map(({ id, currency, balance }) => ({ id, currency, balance }))).toEqual([
      { id: `${aggregationId}:GEL`, currency: 'GEL', balance: 30 },
      { id: `${aggregationId}:EUR`, currency: 'EUR', balance: 0.33 },
    ]);
  });

  it('shows an empty multi-currency account in lari', () => {
    const empty = conceptAccount(aggregationId, 'XXX', balances(['USD', '0.00', '0.00']));

    const { accounts } = normalizeBankData(raw({ accounts: [{ account: empty, transactions: noTransactions }] }), today);

    expect(accounts).toEqual([{ id: `${aggregationId}:GEL`, iban, name: 'Concept', kind: 'current', currency: 'GEL', balance: 0, available: null }]);
  });

  it('prefers the interim booked balance over the closing one (GetBalanceResponse example)', () => {
    const account: TbcAccount = { resourceId: gelAccountId, iban, currency: 'GEL', displayName: 'Concept', balances: balanceResponseExample };

    const [gel] = normalizeBankData(raw({ accounts: [{ account, transactions: noTransactions }] }), today).accounts;

    expect(gel).toMatchObject({ currency: 'GEL', balance: 30, available: 30 });
  });

  it('leaves out currencies the app does not support', () => {
    const pounds: TbcAccount = { resourceId: 'gbp-1', iban, currency: 'GBP', balances: balances(['GBP', '10.00', '10.00']) };

    expect(normalizeBankData(raw({ accounts: [{ account: pounds, transactions: noTransactions }] }), today).accounts).toEqual([]);
  });

  it('reports savings deposits from the savings service', () => {
    expect(normalizeBankData(raw({ savings: savingsExample }), today).accounts).toEqual([
      { id: '456f48dh-f22f-444e-4fgr-15dcf9c6gc19', iban: '', name: 'Term', kind: 'savings', currency: 'GEL', balance: 442.64, available: null },
      { id: '123asd36-g54h-555g-6fgr-16dcf6c9gc27', iban: '', name: 'Term', kind: 'savings', currency: 'USD', balance: 1121.08, available: null },
    ]);
  });

  it('drops card balances that repeat a payment account balance, and keeps the others', () => {
    const accounts = reportableAccounts(accountsExample).map((account) => ({ account, transactions: noTransactions }));
    const cards = cardAccountsExample.map((card) => ({ card, transactions: lists<TbcCardTransaction>([]) }));

    const cardAccounts = normalizeBankData(raw({ accounts, cards }), today).accounts.filter((account) => account.kind === 'card');

    expect(cardAccounts).toEqual([
      { id: '67a95e02-f018-417e-50fa-08dd818830c7:EUR', iban: '', name: 'VISA ••7890', kind: 'card', currency: 'EUR', balance: 0.2, available: 0.2 },
    ]);
  });
});

describe('normalizeBankData transactions', () => {
  const gelAccount = accountsExample[1];

  it('maps the spec example: the own-account transfer is left out, the payment becomes an expense', () => {
    const data = raw({ accounts: [{ account: gelAccount, transactions: lists([ownTransferExample, personalTransferExample]) }] });

    expect(normalizeBankData(data, today).transactions).toEqual([
      {
        id: 'd_11223344556',
        accountId: gelAccountId,
        bookingDate: '2024-03-11',
        amount: 50,
        direction: 'expense',
        currency: 'GEL',
        merchant: 'Creditor Name',
        description: 'პირადი გადარიცხვა თიბისიში',
        category: 'shopping',
        status: 'booked',
      },
    ]);
  });

  it('turns positive amounts into income from the debtor', () => {
    const salary: TbcTransaction = {
      transactionId: 'c_1',
      debtorName: 'Kavkasia Digital LLC',
      transactionAmount: { currency: 'GEL', amount: '3400.00' },
      bookingDate: '2026-10-28',
      remittanceInformationUnstructured: 'ხელფასი',
    };

    const [transaction] = normalizeBankData(raw({ accounts: [{ account: gelAccount, transactions: lists([salary]) }] }), today).transactions;

    expect(transaction).toMatchObject({ direction: 'income', amount: 3400, merchant: 'Kavkasia Digital LLC', category: 'income' });
  });

  it('leaves out transfers to an account of the same customer, found by IBAN', () => {
    const conversion: TbcTransaction = {
      transactionId: 'd_2',
      creditorName: 'Owner Name 1',
      creditorAccount: { iban: 'ge01 tb02 0304 0506 0708 09' },
      transactionAmount: { currency: 'GEL', amount: '-100.00' },
      bookingDate: '2026-10-20',
    };

    expect(normalizeBankData(raw({ accounts: [{ account: gelAccount, transactions: lists([conversion]) }] }), today).transactions).toEqual([]);
  });

  it('dates pending items by their value date', () => {
    const pending: TbcTransaction = {
      transactionId: 'p_1',
      debtorName: 'Studio Lumen LLC',
      transactionAmount: { currency: 'GEL', amount: '250.00' },
      valueDate: '2026-10-30',
      remittanceInformationUnstructured: 'Freelance payment',
    };

    const [transaction] = normalizeBankData(raw({ accounts: [{ account: gelAccount, transactions: lists([], [pending]) }] }), today).transactions;

    expect(transaction).toMatchObject({ id: 'p_1', bookingDate: '2026-10-30', status: 'pending', direction: 'income' });
  });

  it('categorises by merchant and description, and falls back to the description for the merchant', () => {
    const wolt: TbcTransaction = { transactionId: 'd_3', transactionAmount: { currency: 'GEL', amount: '-34.80' }, bookingDate: '2026-10-28', remittanceInformationUnstructured: ' გადახდა -  WOLT ' };

    const [transaction] = normalizeBankData(raw({ accounts: [{ account: gelAccount, transactions: lists([wolt]) }] }), today).transactions;

    expect(transaction).toMatchObject({ merchant: 'გადახდა - WOLT', description: 'გადახდა -  WOLT', category: 'foodDelivery' });
  });

  it('skips entries without a usable amount, currency or date', () => {
    const broken: TbcTransaction[] = [
      { transactionId: 'x1', transactionAmount: { currency: 'GEL', amount: 'n/a' }, bookingDate: '2026-10-01' },
      { transactionId: 'x2', transactionAmount: { currency: 'GBP', amount: '-5.00' }, bookingDate: '2026-10-01' },
      { transactionId: 'x3', transactionAmount: { currency: 'GEL', amount: '-5.00' }, bookingDate: '2026-02-31' },
      { transactionId: 'x4', transactionAmount: { currency: 'GEL', amount: '0.00' }, bookingDate: '2026-10-01' },
    ];

    expect(normalizeBankData(raw({ accounts: [{ account: gelAccount, transactions: lists(broken) }] }), today).transactions).toEqual([]);
  });

  it('assigns transactions of a multi-currency account to the account of their currency', () => {
    const usdPayment: TbcTransaction = { transactionId: 'd_4', creditorName: 'Netflix', transactionAmount: { currency: 'USD', amount: '-9.99' }, bookingDate: '2026-10-22' };

    const [transaction] = normalizeBankData(raw({ accounts: [{ account: accountsExample[0], transactions: lists([usdPayment]) }] }), today).transactions;

    expect(transaction).toMatchObject({ accountId: `${aggregationId}:USD`, currency: 'USD', amount: 9.99, category: 'subscriptions' });
  });

  it('drops card transactions that repeat an account transaction, own transfers included', () => {
    const data = raw({
      accounts: [{ account: gelAccount, transactions: lists([ownTransferExample, personalTransferExample]) }],
      cards: [{ card: cardAccountsExample[0], transactions: lists(cardTransactionsExample) }],
    });

    expect(normalizeBankData(data, today).transactions.map((transaction) => transaction.id)).toEqual(['d_11223344556']);
  });

  it('keeps card-only transactions, with an ID that stays the same between fetches', () => {
    const data = raw({ cards: [{ card: cardAccountsExample[0], transactions: lists(cardTransactionsExample) }] });

    const first = normalizeBankData(data, today).transactions;
    const second = normalizeBankData(data, today).transactions;

    expect(first.map((transaction) => transaction.id)).toEqual(second.map((transaction) => transaction.id));
    expect(new Set(first.map((transaction) => transaction.id)).size).toBe(2);
    expect(first[0]).toMatchObject({
      accountId: '0f92178b-a77f-45d8-50f5-08dd818830c7:GEL',
      bookingDate: '2024-03-11',
      direction: 'expense',
      merchant: 'TBC Bank transaction',
      category: 'shopping',
    });
    expect(first[0].id).toMatch(/^tx_[0-9a-f]{24}$/);
  });

  it('keeps each card copy of a repeated purchase only once per account transaction', () => {
    const coffee: TbcTransaction = { transactionId: 'd_5', creditorName: 'Coffee Lab', transactionAmount: { currency: 'GEL', amount: '-9.50' }, bookingDate: '2026-10-29' };
    const cardCoffee: TbcCardTransaction = { cardTransactionId: 'card_5', bookingDate: '2026-10-29', transactionAmount: { currency: 'GEL', amount: '-9.50' }, transactionDetails: 'COFFEE LAB' };
    const data = raw({
      accounts: [{ account: gelAccount, transactions: lists([coffee]) }],
      cards: [{ card: cardAccountsExample[0], transactions: lists([cardCoffee, { ...cardCoffee, cardTransactionId: 'card_6' }]) }],
    });

    expect(normalizeBankData(data, today).transactions.map((transaction) => transaction.id)).toEqual(['d_5', 'card_6']);
  });

  it('lists the newest transactions first', () => {
    const older: TbcTransaction = { ...personalTransferExample, transactionId: 'older', bookingDate: '2026-09-01' };
    const newer: TbcTransaction = { ...personalTransferExample, transactionId: 'newer', bookingDate: '2026-10-01' };

    const ids = normalizeBankData(raw({ accounts: [{ account: gelAccount, transactions: lists([older, newer]) }] }), today).transactions.map((t) => t.id);

    expect(ids).toEqual(['newer', 'older']);
  });
});

describe('normalizeLoan', () => {
  const consumerLoan: TbcLoan = {
    resourceId: 'loan-1',
    currency: 'GEL',
    relatedDates: { contractStartDate: '2024-11-05T00:00:00', contractEndDate: '2028-11-05T00:00:00' },
    balances: [{ balanceAmount: { currency: 'GEL', amount: 4944.2 }, balanceType: 'InterimBooked', referenceDate: '2026-10-30T00:00:00' }],
    status: 'Enabled',
    interest: { rate: { percentage: 20 } },
    product: 'Consumer loan',
  };

  it('derives the schedule and instalment from the contract dates, rate and outstanding amount', () => {
    expect(normalizeLoan(consumerLoan, today)).toEqual({
      id: 'loan-1',
      name: 'Consumer loan',
      currency: 'GEL',
      outstanding: 4944.2,
      monthlyPayment: 243.44,
      annualRatePercent: 20,
      remainingMonths: 25,
      nextPaymentDate: '2026-11-05',
    });
  });

  it('moves to next month on the payment day itself', () => {
    expect(normalizeLoan(consumerLoan, new Date('2026-11-05T12:00:00Z'))).toMatchObject({ nextPaymentDate: '2026-12-05', remainingMonths: 24 });
  });

  it('reads an outstanding amount signed as a liability', () => {
    const negative: TbcLoan = { ...consumerLoan, balances: [{ balanceAmount: { currency: 'GEL', amount: -4944.2 }, balanceType: 'ClosingBooked' }] };

    expect(normalizeLoan(negative, today)?.outstanding).toBe(4944.2);
  });

  it('leaves the schedule unknown without contract dates', () => {
    expect(normalizeLoan({ ...consumerLoan, relatedDates: undefined }, today)).toMatchObject({
      monthlyPayment: null,
      remainingMonths: null,
      nextPaymentDate: null,
      annualRatePercent: 20,
    });
  });

  it('has no next payment once the contract has ended', () => {
    const ended: TbcLoan = { ...consumerLoan, relatedDates: { contractStartDate: '2020-01-10', contractEndDate: '2024-01-10' } };

    expect(normalizeLoan(ended, today)).toMatchObject({ nextPaymentDate: null, remainingMonths: null });
  });

  it('skips deleted loans and unsupported currencies', () => {
    expect(normalizeLoan({ ...consumerLoan, status: 'Deleted' }, today)).toBeNull();
    expect(normalizeLoan({ ...consumerLoan, currency: 'GBP' }, today)).toBeNull();
  });
});

describe('annuityPayment', () => {
  it('matches the iOS sample loan: 8,000 ₾ at 20% over 48 months is 243.44 ₾ a month', () => {
    expect(annuityPayment(8000, 20, 48)).toBe(243.44);
  });

  it('divides evenly without interest', () => {
    expect(annuityPayment(1200, 0, 12)).toBe(100);
  });
});
