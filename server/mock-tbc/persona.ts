import type { CurrencyCode } from '../../shared/bank.ts';
import { addMonths, daysInMonth, toIsoDate } from '../openbanking/dates.ts';
import type {
  TbcAccount,
  TbcAccountReference,
  TbcAmount,
  TbcBalance,
  TbcBalancesResponse,
  TbcCardAccount,
  TbcCardTransaction,
  TbcLoan,
  TbcLoanBalance,
  TbcSavingsAccount,
  TbcTransaction,
} from '../openbanking/tbc-types.ts';
import { mockTbcBasePath } from './responses.ts';

/**
 * The mock bank's customer, Nino Nadiradze. Her accounts and last four months mirror the iOS app's SampleData,
 * so the web app shows the same figures:
 *   - the current month replays SampleData's October day by day: salary 3,400 ₾ on the 28th, rent 850 ₾ on the
 *     1st, the 243.44 ₾ loan payment on the 5th, Netflix $9.99, Spotify €5.99, iCloud $0.99, everyday spending,
 *     and today the pending freelance payment (250 ₾) and Zara refund;
 *   - the three months before reproduce SampleData.History (September spending 2,240 ₾, delivery 118 ₾ in
 *     August and 142 ₾ in September) and average out to SampleData.typicalMonthlySpending per category;
 *   - Everyday holds 2,486.40 ₾, Savings 14,850 ₾, and the consumer loan (8,000 ₾ at 20% over 48 months,
 *     23 payments made) has 4,944.20 ₾ outstanding.
 * Dates are relative to `today`, so the data is always current. Like a TBC multi-currency account, Everyday is an
 * aggregation account with GEL, USD and EUR sub-accounts; the USD and EUR subscriptions are booked on those.
 */

export interface PersonaReport<T> {
  reference: TbcAccountReference;
  booked: T[];
  pending: T[];
}

interface PersonaItem {
  day: number;
  /** The creditor of money out, or the debtor of money in. */
  counterparty: string;
  /** Signed, in major units: negative is money out. */
  amount: number;
  currency: CurrencyCode;
  /** Card payments also appear in the debit card's report; transfers only on the account. */
  channel: 'card' | 'transfer';
  /** The remittance information of a transfer, or the terminal descriptor of a card payment. */
  description: string;
  counterpartyIban?: string;
}

interface DatedItem extends PersonaItem {
  id: string;
  date: string;
}

export const mockAccountIds = {
  everyday: '0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a01',
  everydayGel: '0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a02',
  everydayUsd: '0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a03',
  everydayEur: '0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a04',
  card: '0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a05',
  loan: '0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a06',
  savings: '0b7e6c1a-4d2f-4e8b-9a31-5c2d7f8e1a07',
} as const;

const owner = 'Nino Nadiradze';
const everydayIban = 'GE82TB7724936515100001';
const savingsIban = 'GE02TB7724936615100002';
const maskedPan = '427638******4821';
const aisLinkBase = `${mockTbcBasePath}/0.8/v1`;
const monthsOfHistory = 4;

const everydayBalances: Record<CurrencyCode, number> = { GEL: 2486.4, USD: 0, EUR: 0 };
const everydaySubAccounts: ReadonlyArray<{ id: string; currency: CurrencyCode }> = [
  { id: mockAccountIds.everydayGel, currency: 'GEL' },
  { id: mockAccountIds.everydayUsd, currency: 'USD' },
  { id: mockAccountIds.everydayEur, currency: 'EUR' },
];
const allCurrencies: readonly CurrencyCode[] = ['GEL', 'USD', 'EUR'];
const savingsBalance = 14850;
const loanTerms = { principal: 8000, annualRatePercent: 20, months: 48, paymentsMade: 23, paymentDay: 5 };

/** What the consent screen offers to share. */
export const consentScreenAccounts: ReadonlyArray<{ name: string; detail: string }> = [
  { name: 'Everyday · ყოველდღიური', detail: `${everydayIban} · GEL, USD, EUR` },
  { name: 'VISA', detail: maskedPan },
  { name: 'Savings · დანაზოგი', detail: 'GEL' },
  { name: 'Consumer loan · სამომხმარებლო სესხი', detail: 'GEL' },
];

// MARK: The months

function card(day: number, merchant: string, amount: number, currency: CurrencyCode = 'GEL', descriptor = merchant.toUpperCase()): PersonaItem {
  return { day, counterparty: merchant, amount: -amount, currency, channel: 'card', description: descriptor };
}

function transfer(day: number, counterparty: string, amount: number, description: string, counterpartyIban?: string): PersonaItem {
  return { day, counterparty, amount, currency: 'GEL', channel: 'transfer', description, counterpartyIban };
}

/** By month, index 0 being the current month. */
const electricityBills = [64.3, 63.3, 70.3, 61.4];
const savingsTransfers = [450, 1050, 800, 600];

function recurringItems(monthsAgo: number): PersonaItem[] {
  return [
    transfer(1, 'Levan Kapanadze', -850, 'ბინის ქირა / Rent'),
    transfer(5, 'TBC Bank', -243.44, 'სესხის დაფარვა / Loan repayment'),
    card(15, 'iCloud+', 0.99, 'USD', 'APPLE.COM/BILL ICLOUD'),
    transfer(15, 'Telasi', -electricityBills[monthsAgo], 'ელექტროენერგია - თელასი'),
    transfer(21, 'Magti', -25, 'მობილური კავშირი - მაგთი'),
    card(22, 'Netflix', 9.99, 'USD', 'NETFLIX.COM'),
    card(23, 'Spotify', 5.99, 'EUR', 'SPOTIFY P2A1C3'),
    transfer(28, 'Kavkasia Digital LLC', 3400, 'ხელფასი / Salary'),
    transfer(28, owner, -savingsTransfers[monthsAgo], 'საკუთარ ანგარიშზე გადარიცხვა', savingsIban),
  ];
}

/** Everyday card spending by month, index 0 being the current month. */
const everydaySpending: readonly PersonaItem[][] = [
  // SampleData.transactions (October in the iOS app).
  [
    card(3, 'Nikora', 73.1), card(8, 'Spar', 62.4), card(10, 'Aversi', 23.75), card(12, 'Wolt', 40.3),
    card(17, 'Entrée', 54), card(18, 'Zara', 159.9), card(19, 'Wissol', 80), card(20, 'Wolt', 38.4),
    card(24, 'Khinkali House', 86), card(25, 'Carrefour', 112.35), card(25, 'Glovo', 41.6), card(26, 'Nikora', 48.2),
    card(26, 'Wolt', 29.9), card(28, 'Tbilisi Metro', 1), card(28, "McDonald's", 26.5), card(28, 'Wolt', 34.8),
    card(29, 'Bolt', 7.4), card(29, 'Coffee Lab', 9.5),
  ],
  // Last month (September in the iOS app): 2,240 ₾ spent in all, 142 ₾ of it on delivery.
  [
    card(2, 'Nikora', 68.4), card(3, 'Bolt', 8.6), card(4, 'Coffee Lab', 12.8), card(6, 'Goodwill', 94.3),
    card(7, 'Wolt', 36.2), card(9, 'Café Littera', 58.5), card(10, 'Tbilisi Metro', 10), card(11, 'Spar', 41.7),
    card(12, 'LC Waikiki', 64.95), card(13, 'Glovo', 33.5), card(14, 'Khinkali House', 72), card(16, 'Wissol', 70),
    card(17, 'PSP', 31.9), card(18, 'H&M', 124.98), card(19, 'Carrefour', 105.6), card(20, "McDonald's", 24.9),
    card(21, 'Wolt', 39.8), card(24, 'Agrohub', 42.4), card(25, 'Bolt', 10), card(26, 'Wolt', 32.5),
    card(27, 'Entrée', 28.1),
  ],
  // Two months ago (August): 118 ₾ on delivery.
  [
    card(3, 'Nikora', 59.8), card(5, 'Coffee Lab', 11), card(6, 'Bolt', 6.7), card(8, 'Wolt', 42.3),
    card(9, 'Carrefour', 121.45), card(11, 'Tbilisi Metro', 10), card(12, 'Khinkali House', 64.5), card(14, 'Zara', 74.99),
    card(15, 'Ori Nabiji', 38.6), card(17, 'Glovo', 38.9), card(18, 'Aversi', 24.7), card(19, 'Entrée', 41),
    card(20, 'Wissol', 70), card(23, 'Spar', 86.5), card(24, 'Wolt', 36.8), card(26, "McDonald's", 46),
  ],
  // Three months ago (July): 130 ₾ on delivery.
  [
    card(2, 'Nikora', 72.15), card(3, 'Bolt', 7.2), card(4, 'Coffee Lab', 14.2), card(7, 'Wolt', 44.1),
    card(9, 'Tbilisi Metro', 10), card(10, 'Goodwill', 88.9), card(11, 'Café Littera', 49), card(13, 'LC Waikiki', 95.08),
    card(16, 'Glovo', 41.2), card(18, 'Carrefour', 97.4), card(19, 'Khinkali House', 58), card(21, 'Wissol', 67.5),
    card(22, 'GPC', 18.4), card(23, 'Wolt', 44.7), card(25, 'Agrohub', 42.8), card(27, "McDonald's", 30),
  ],
];

/** SampleData.incomingTransactions: money arriving today, still pending. */
const incomingToday: readonly PersonaItem[] = [
  transfer(0, 'Studio Lumen LLC', 250, 'Freelance payment'),
  transfer(0, 'Zara', 59.9, 'Refund - ZARA'),
];

/** Every booked item up to `today`. IDs are stable from day to day, with TBC's d_/c_ (debit/credit) prefixes. */
function bookedItems(today: Date): DatedItem[] {
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const items: DatedItem[] = [];
  for (let monthsAgo = 0; monthsAgo < monthsOfHistory; monthsAgo++) {
    const month = addMonths(firstOfMonth, -monthsAgo);
    const monthKey = toIsoDate(month).slice(0, 7).replace('-', '');
    [...recurringItems(monthsAgo), ...everydaySpending[monthsAgo]].forEach((item, index) => {
      const date = dayOf(month, item.day);
      if (date > today) return;
      items.push({ ...item, id: `${item.amount < 0 ? 'd' : 'c'}_${monthKey}${String(index).padStart(3, '0')}`, date: toIsoDate(date) });
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

function pendingItems(today: Date): DatedItem[] {
  const date = toIsoDate(today);
  return incomingToday.map((item, index) => ({ ...item, id: `p_${date.replaceAll('-', '')}${index}`, date }));
}

/** `day` of `month`, clamped to the month's length. */
function dayOf(month: Date, day: number): Date {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))));
}

// MARK: TBC payloads

/** The persona as TBC's API would report her on `today`. */
export class Persona {
  private readonly today: Date;
  private readonly booked: DatedItem[];
  private readonly pending: DatedItem[];

  constructor(today: Date) {
    this.today = today;
    this.booked = bookedItems(today);
    this.pending = pendingItems(today);
  }

  accounts(): TbcAccount[] {
    return [
      this.everydayAccount(mockAccountIds.everyday, 'XXX', allCurrencies),
      ...everydaySubAccounts.map((sub) => this.everydayAccount(sub.id, sub.currency, [sub.currency], mockAccountIds.everyday)),
    ];
  }

  balances(accountId: string): TbcBalancesResponse | null {
    const account = this.accounts().find((candidate) => candidate.resourceId === accountId);
    return account ? { account: { iban: account.iban, currency: account.currency }, balances: account.balances } : null;
  }

  accountReport(accountId: string): PersonaReport<TbcTransaction> | null {
    const sub = everydaySubAccounts.find((candidate) => candidate.id === accountId);
    if (!sub && accountId !== mockAccountIds.everyday) return null;
    const inAccount = (item: DatedItem) => !sub || item.currency === sub.currency;
    return {
      reference: { iban: everydayIban, currency: sub?.currency ?? 'XXX' },
      booked: this.booked.filter(inAccount).map((item) => accountTransaction(item, 'booked')),
      pending: this.pending.filter(inAccount).map((item) => accountTransaction(item, 'pending')),
    };
  }

  cardAccounts(): TbcCardAccount[] {
    const self = `${aisLinkBase}/card-accounts/${mockAccountIds.card}`;
    return [
      {
        resourceId: mockAccountIds.card,
        maskedPan,
        currency: 'XXX',
        ownerName: owner,
        name: owner,
        product: 'VISA',
        status: 'enabled',
        usage: 'PRIV',
        // The Everyday account's debit card, so TBC reports the account's balances again.
        balances: balancesFor(allCurrencies, this.today),
        _links: { balances: { href: `${self}/balances` }, transactions: { href: `${self}/transactions` }, cardAccount: { href: self } },
      },
    ];
  }

  cardReport(cardId: string): PersonaReport<TbcCardTransaction> | null {
    if (cardId !== mockAccountIds.card) return null;
    return {
      reference: { maskedPan, currency: 'XXX' },
      booked: this.booked.filter((item) => item.channel === 'card').map(cardTransaction),
      pending: [],
    };
  }

  loans(): TbcLoan[] {
    const lastPayment = latestLoanPaymentDate(this.today);
    const start = addMonths(lastPayment, -loanTerms.paymentsMade);
    const end = addMonths(start, loanTerms.months);
    return [
      {
        resourceId: mockAccountIds.loan,
        currency: 'GEL',
        relatedDates: { contractStartDate: `${toIsoDate(start)}T00:00:00`, contractEndDate: `${toIsoDate(end)}T00:00:00` },
        balances: this.loanBalances(mockAccountIds.loan),
        status: 'Enabled',
        interest: { rate: { percentage: loanTerms.annualRatePercent } },
        product: 'Consumer loan',
        _links: { balances: { href: `${mockTbcBasePath}/v2/loans/${mockAccountIds.loan}/balances` } },
      },
    ];
  }

  loanBalances(loanId: string): TbcLoanBalance[] | null {
    if (loanId !== mockAccountIds.loan) return null;
    return [
      {
        balanceAmount: { currency: 'GEL', amount: outstandingLoanPrincipal() },
        balanceType: 'InterimBooked',
        balanceSubTypeProprietary: null,
        referenceDate: `${toIsoDate(this.today)}T00:00:00`,
      },
    ];
  }

  savings(): TbcSavingsAccount[] {
    return [
      {
        resourceId: mockAccountIds.savings,
        product: 'Savings',
        currency: 'GEL',
        status: 'Active',
        period: null,
        contractStartDate: toIsoDate(addMonths(this.today, -30)),
        ownerName: owner,
        cashAccountType: 'SVGS',
        balances: [
          { balanceAmount: { currency: 'GEL', amount: savingsBalance.toFixed(2) }, balanceType: 'OpeningBooked', referenceDate: toIsoDate(this.today) },
        ],
        links: { balances: { href: `v2/savings/${mockAccountIds.savings}/balances` } },
      },
    ];
  }

  private everydayAccount(resourceId: string, currency: string, currencies: readonly CurrencyCode[], aggregationAccountId?: string): TbcAccount {
    const self = `${aisLinkBase}/accounts/${resourceId}`;
    return {
      resourceId,
      iban: everydayIban,
      currency,
      ownerName: owner,
      name: owner,
      displayName: 'Everyday',
      cashAccountType: 'CARD',
      status: 'enabled',
      bic: 'TBCBGE22',
      usage: 'PRIV',
      balances: balancesFor(currencies, this.today),
      _links: {
        balances: { href: `${self}/balances` },
        transactions: { href: `${self}/transactions` },
        account: { href: self },
        ...(aggregationAccountId ? { aggregationAccount: { href: `${aisLinkBase}/accounts/${aggregationAccountId}` } } : {}),
      },
    };
  }
}

function balancesFor(currencies: readonly CurrencyCode[], today: Date): TbcBalance[] {
  const date = toIsoDate(today);
  return currencies.flatMap((currency) => {
    const balanceAmount = { currency, amount: everydayBalances[currency].toFixed(2) };
    return [
      { balanceType: 'interimBooked', balanceAmount, creditLimitIncluded: false, referenceDate: date, lastChangeDateTime: `${date}T00:00:00` },
      { balanceType: 'interimAvailable', balanceAmount, creditLimitIncluded: false },
    ];
  });
}

function accountTransaction(item: DatedItem, status: 'booked' | 'pending'): TbcTransaction {
  const counterpartyAccount = item.counterpartyIban ? { iban: item.counterpartyIban, currency: item.currency } : undefined;
  const counterparty =
    item.amount < 0
      ? { creditorName: item.counterparty, creditorAccount: counterpartyAccount }
      : { debtorName: item.counterparty, debtorAccount: counterpartyAccount };
  return {
    transactionId: item.id,
    entryReference: item.id,
    ...counterparty,
    transactionAmount: amountOf(item),
    bookingDate: status === 'booked' ? item.date : undefined,
    valueDate: item.date,
    remittanceInformationUnstructured: item.channel === 'card' ? `გადახდა - ${item.description}` : item.description,
  };
}

function cardTransaction(item: DatedItem): TbcCardTransaction {
  return {
    cardTransactionId: `card_${item.id}`,
    transactionDate: item.date,
    bookingDate: item.date,
    transactionAmount: amountOf(item),
    transactionDetails: item.description,
    maskedPan,
  };
}

function amountOf(item: PersonaItem): TbcAmount {
  return { currency: item.currency, amount: item.amount.toFixed(2) };
}

/** The most recent instalment date on or before `today`. */
function latestLoanPaymentDate(today: Date): Date {
  const thisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), loanTerms.paymentDay));
  return thisMonth <= today ? thisMonth : addMonths(thisMonth, -1);
}

/** The annuity balance after the payments made, as SampleData.currentLoan computes it: 4,944.20 ₾. */
function outstandingLoanPrincipal(): number {
  const { principal, annualRatePercent, months, paymentsMade } = loanTerms;
  const rate = annualRatePercent / 1200;
  const payment = (principal * rate) / (1 - (1 + rate) ** -months);
  const growth = (1 + rate) ** paymentsMade;
  return Math.round((principal * growth - (payment * (growth - 1)) / rate) * 100) / 100;
}
