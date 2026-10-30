import { createHash } from 'node:crypto';
import type { BankAccount, BankLoan, BankSnapshot, BankTransaction, CurrencyCode } from '../../shared/bank.ts';
import { categorize, looksLikeOwnTransfer } from './categorize.ts';
import { addMonths, calendarMonthsBetween, parseIsoDate, toIsoDate } from './dates.ts';
import type {
  TbcAccount,
  TbcBalance,
  TbcCardAccount,
  TbcCardTransaction,
  TbcLoan,
  TbcLoanBalance,
  TbcSavingsAccount,
  TbcTransaction,
  TbcTransactionLists,
} from './tbc-types.ts';

/** An account that can be read further: TBC addresses it by `resourceId`. */
export type ReadableAccount = TbcAccount & { resourceId: string };

/** Everything read from TBC for one snapshot, before normalisation. */
export interface RawBankData {
  /** The accounts `reportableAccounts` selected, with their transactions. */
  accounts: Array<{ account: TbcAccount; transactions: TbcTransactionLists<TbcTransaction> }>;
  cards: Array<{ card: TbcCardAccount; transactions: TbcTransactionLists<TbcCardTransaction> }>;
  loans: TbcLoan[];
  savings: TbcSavingsAccount[];
}

export type NormalizedBankData = Pick<BankSnapshot, 'accounts' | 'transactions' | 'loans'>;

type TransactionStatus = BankTransaction['status'];

interface Money {
  /** Signed: negative is money out. */
  amount: number;
  currency: CurrencyCode;
}

interface CurrencyBalance {
  currency: CurrencyCode;
  booked: number;
  available: number | null;
}

/** A balance of any TBC product: loan amounts are numbers, the others decimal strings. */
interface BalanceEntry {
  balanceType?: string;
  balanceAmount?: { currency?: string; amount?: string | number };
}

const supportedCurrencies: ReadonlySet<string> = new Set<CurrencyCode>(['GEL', 'USD', 'EUR']);
const homeCurrency: CurrencyCode = 'GEL';
/** ISO 4217 "no currency": how TBC marks a multi-currency account holding a balance per currency. */
const multiCurrency = 'XXX';

/** In order of preference, intraday figures first. Compared case-insensitively: savings use PascalCase. */
const bookedBalanceTypes = ['interimbooked', 'closingbooked', 'openingbooked', 'expected'];
const availableBalanceTypes = ['interimavailable', 'forwardavailable'];
const loanBalanceTypes = ['interimbooked', 'closingbooked', 'openingbooked'];

const fallbackMerchant = 'TBC Bank transaction';
const maxMerchantLength = 60;

export function normalizeBankData(raw: RawBankData, today: Date): NormalizedBankData {
  const paymentAccounts = raw.accounts.flatMap(({ account }) => normalizeAccount(account));
  const savingsAccounts = raw.savings.flatMap(normalizeSavingsAccount);
  const cardAccounts = withoutMirroredBalances(
    raw.cards.flatMap(({ card }) => normalizeCardAccount(card)),
    [...paymentAccounts, ...savingsAccounts],
  );
  return {
    accounts: [...paymentAccounts, ...cardAccounts, ...savingsAccounts],
    transactions: normalizeTransactions(raw),
    loans: raw.loans.flatMap((loan) => normalizeLoan(loan, today) ?? []),
  };
}

/**
 * The accounts to read. TBC lists a multi-currency account twice: as an aggregation account (currency XXX,
 * every currency's balance) and as one sub-account per currency whose `aggregationAccount` link points back.
 * Reading both would count the money twice, so an aggregation account is dropped when its sub-accounts are listed.
 */
export function reportableAccounts(accounts: TbcAccount[]): ReadableAccount[] {
  const aggregationIds = new Set(accounts.flatMap((account) => lastPathSegment(account._links?.aggregationAccount?.href) ?? []));
  return accounts
    .filter(isReadable)
    .filter((account) => !isClosed(account.status) && !aggregationIds.has(account.resourceId));
}

function isReadable(account: TbcAccount): account is ReadableAccount {
  return typeof account.resourceId === 'string' && account.resourceId.length > 0;
}

// MARK: Accounts

function normalizeAccount(account: TbcAccount): BankAccount[] {
  if (!account.resourceId || isClosed(account.status)) return [];
  return bankAccounts(account.resourceId, account.currency, account.balances, {
    iban: account.iban ?? '',
    name: account.displayName || account.name || account.product || 'TBC account',
    kind: account.cashAccountType?.toUpperCase() === 'SVGS' ? 'savings' : 'current',
  });
}

function normalizeCardAccount(card: TbcCardAccount): BankAccount[] {
  if (!card.resourceId || isClosed(card.status)) return [];
  const lastDigits = card.maskedPan?.slice(-4);
  return bankAccounts(card.resourceId, card.currency, card.balances, {
    iban: '',
    name: card.displayName || [card.product || 'Card', lastDigits && `••${lastDigits}`].filter(Boolean).join(' '),
    kind: 'card',
  });
}

function normalizeSavingsAccount(savings: TbcSavingsAccount): BankAccount[] {
  if (!savings.resourceId) return [];
  return bankAccounts(savings.resourceId, savings.currency, savings.balances, {
    iban: '',
    name: savings.product || 'Savings',
    kind: 'savings',
  });
}

/** One BankAccount per reported currency of a TBC account (see `currencyEntries`). */
function bankAccounts(
  resourceId: string,
  accountCurrency: string | undefined,
  balances: readonly TbcBalance[] | null | undefined,
  details: Pick<BankAccount, 'iban' | 'name' | 'kind'>,
): BankAccount[] {
  return currencyEntries(accountCurrency, balancesByCurrency(balances ?? [])).map((entry) => ({
    id: accountId(resourceId, accountCurrency, entry.currency),
    ...details,
    currency: entry.currency,
    balance: entry.booked,
    available: entry.available,
  }));
}

/**
 * A single-currency account reports its own currency's balance, zero included. A multi-currency account
 * reports every currency that holds money; one holding no money at all still appears, in lari.
 */
function currencyEntries(accountCurrency: string | undefined, balances: CurrencyBalance[]): CurrencyBalance[] {
  if (!isMultiCurrency(accountCurrency)) {
    if (!isCurrencyCode(accountCurrency)) return [];
    return [balances.find((balance) => balance.currency === accountCurrency) ?? emptyBalance(accountCurrency)];
  }
  const funded = balances.filter((balance) => balance.booked !== 0);
  if (funded.length > 0) return funded;
  return [balances.find((balance) => balance.currency === homeCurrency) ?? emptyBalance(homeCurrency)];
}

function balancesByCurrency(balances: readonly TbcBalance[]): CurrencyBalance[] {
  const byCurrency = new Map<CurrencyCode, TbcBalance[]>();
  for (const balance of balances) {
    const currency = balance.balanceAmount?.currency;
    if (isCurrencyCode(currency)) byCurrency.set(currency, [...(byCurrency.get(currency) ?? []), balance]);
  }
  return [...byCurrency].map(([currency, entries]) => ({
    currency,
    booked: amountOfType(entries, bookedBalanceTypes) ?? amountOfType(entries, availableBalanceTypes) ?? 0,
    available: amountOfType(entries, availableBalanceTypes),
  }));
}

function amountOfType(balances: readonly BalanceEntry[], preferredTypes: readonly string[]): number | null {
  for (const type of preferredTypes) {
    const match = balances.find((balance) => balance.balanceType?.toLowerCase() === type);
    const amount = parseAmount(match?.balanceAmount?.amount);
    if (amount !== null) return amount;
  }
  return null;
}

/**
 * TBC's card accounts can be the debit cards of the payment accounts, reporting the same money again. A card
 * balance identical to a listed account balance (same currency and amount) is dropped, so it counts once.
 */
function withoutMirroredBalances(cards: BankAccount[], accounts: BankAccount[]): BankAccount[] {
  const listed = new Set(accounts.map(balanceKey));
  return cards.filter((card) => !listed.has(balanceKey(card)));
}

function balanceKey(account: BankAccount): string {
  return `${account.currency}|${account.balance}`;
}

function accountId(resourceId: string, accountCurrency: string | undefined, currency: CurrencyCode): string {
  return isMultiCurrency(accountCurrency) ? `${resourceId}:${currency}` : resourceId;
}

// MARK: Transactions

interface ReportPosition {
  resourceId: string;
  status: TransactionStatus;
  index: number;
}

interface TransactionContext extends ReportPosition {
  accountCurrency: string | undefined;
}

interface AccountTransaction {
  transaction: BankTransaction;
  /** A transfer between the customer's own accounts moves no money in or out, so it is left out. */
  ownTransfer: boolean;
}

function normalizeTransactions(raw: RawBankData): BankTransaction[] {
  const ownIbans = new Set(raw.accounts.flatMap(({ account }) => (account.iban ? [normalizeIban(account.iban)] : [])));
  const accountTransactions = raw.accounts.flatMap(({ account, transactions }) =>
    reportEntries(account.resourceId, transactions, (tx, position) =>
      normalizeAccountTransaction(tx, { ...position, accountCurrency: account.currency }, ownIbans),
    ),
  );
  const cardTransactions = raw.cards.flatMap(({ card, transactions }) =>
    reportEntries(card.resourceId, transactions, (tx, position) =>
      normalizeCardTransaction(tx, { ...position, accountCurrency: card.currency }),
    ),
  );
  return [
    ...accountTransactions.filter((entry) => !entry.ownTransfer).map((entry) => entry.transaction),
    ...withoutDuplicatesOf(cardTransactions, accountTransactions.map((entry) => entry.transaction)),
  ].sort(newestFirst);
}

function reportEntries<T, R>(
  resourceId: string | undefined,
  lists: TbcTransactionLists<T>,
  normalize: (tx: T, position: ReportPosition) => R | null,
): R[] {
  if (!resourceId) return [];
  const entriesWith = (status: TransactionStatus) => (tx: T, index: number) => normalize(tx, { resourceId, status, index });
  return [...lists.booked.map(entriesWith('booked')), ...lists.pending.map(entriesWith('pending'))].filter(isPresent);
}

function normalizeAccountTransaction(
  tx: TbcTransaction,
  context: TransactionContext,
  ownIbans: ReadonlySet<string>,
): AccountTransaction | null {
  const money = parseMoney(tx.transactionAmount);
  const date = transactionDate(context.status, tx.bookingDate, tx.valueDate);
  if (!money || !date) return null;
  const moneyOut = money.amount < 0;
  const description = (tx.remittanceInformationUnstructured ?? tx.additionalInformation ?? '').trim();
  const counterpartyIban = (moneyOut ? tx.creditorAccount : tx.debtorAccount)?.iban;
  return {
    transaction: bankTransaction(context, {
      id: tx.transactionId || tx.entryReference,
      money,
      date,
      counterparty: moneyOut ? tx.creditorName : tx.debtorName,
      description,
    }),
    ownTransfer:
      (counterpartyIban !== undefined && ownIbans.has(normalizeIban(counterpartyIban))) ||
      looksLikeOwnTransfer(`${description} ${tx.additionalInformation ?? ''}`),
  };
}

function normalizeCardTransaction(tx: TbcCardTransaction, context: TransactionContext): BankTransaction | null {
  const money = parseMoney(tx.transactionAmount);
  const date = transactionDate(context.status, tx.bookingDate, tx.transactionDate);
  if (!money || !date) return null;
  return bankTransaction(context, {
    id: tx.cardTransactionId,
    money,
    date,
    counterparty: undefined,
    description: (tx.transactionDetails ?? '').trim(),
  });
}

interface TransactionFields {
  id: string | undefined;
  money: Money;
  date: string;
  counterparty: string | undefined;
  description: string;
}

function bankTransaction(context: TransactionContext, fields: TransactionFields): BankTransaction {
  const direction = fields.money.amount < 0 ? 'expense' : 'income';
  const merchant = displayMerchant(fields.counterparty, fields.description);
  return {
    id: fields.id || syntheticTransactionId(context, fields),
    accountId: accountId(context.resourceId, context.accountCurrency, fields.money.currency),
    bookingDate: fields.date,
    amount: Math.abs(fields.money.amount),
    direction,
    currency: fields.money.currency,
    merchant,
    description: fields.description,
    category: categorize(direction, `${merchant} ${fields.description}`),
    status: context.status,
  };
}

/** Booked items by booking date; pending ones, which have none yet, by their value or transaction date. */
function transactionDate(
  status: TransactionStatus,
  bookingDate: string | undefined,
  otherDate: string | undefined,
): string | null {
  const date = parseIsoDate(status === 'pending' ? (otherDate ?? bookingDate) : (bookingDate ?? otherDate));
  return date ? toIsoDate(date) : null;
}

function displayMerchant(counterparty: string | undefined, description: string): string {
  const name = collapseWhitespace(counterparty) || collapseWhitespace(description) || fallbackMerchant;
  return name.length > maxMerchantLength ? `${name.slice(0, maxMerchantLength - 1)}…` : name;
}

/** TBC's card transactions can come without an ID. This one stays the same across fetches of the same report. */
function syntheticTransactionId(context: TransactionContext, fields: TransactionFields): string {
  const source = [context.resourceId, context.status, context.index, fields.date, fields.money.amount, fields.money.currency, fields.description];
  return `tx_${createHash('sha256').update(source.join('|')).digest('hex').slice(0, 24)}`;
}

/**
 * A debit-card purchase can appear in both the card account's and the payment account's report. A card
 * transaction matching an account transaction (same day, direction, amount and currency) is dropped; each
 * account transaction absorbs at most one card copy.
 */
function withoutDuplicatesOf(cardTransactions: BankTransaction[], accountTransactions: BankTransaction[]): BankTransaction[] {
  const unmatched = new Map<string, number>();
  for (const tx of accountTransactions) unmatched.set(fingerprint(tx), (unmatched.get(fingerprint(tx)) ?? 0) + 1);
  return cardTransactions.filter((tx) => {
    const count = unmatched.get(fingerprint(tx)) ?? 0;
    if (count === 0) return true;
    unmatched.set(fingerprint(tx), count - 1);
    return false;
  });
}

function fingerprint(tx: BankTransaction): string {
  return `${tx.bookingDate}|${tx.direction}|${tx.amount}|${tx.currency}`;
}

function newestFirst(a: BankTransaction, b: BankTransaction): number {
  return b.bookingDate.localeCompare(a.bookingDate);
}

// MARK: Loans

export function normalizeLoan(loan: TbcLoan, today: Date): BankLoan | null {
  if (!loan.resourceId || !isCurrencyCode(loan.currency) || isClosed(loan.status)) return null;
  const outstanding = loanOutstanding(loan.balances ?? [], loan.currency);
  const rate = loan.interest?.rate?.percentage;
  const annualRatePercent = typeof rate === 'number' && Number.isFinite(rate) ? rate : null;
  const schedule = paymentSchedule(loan, today);
  return {
    id: loan.resourceId,
    name: loan.product || 'Loan',
    currency: loan.currency,
    outstanding,
    monthlyPayment:
      schedule && annualRatePercent !== null ? annuityPayment(outstanding, annualRatePercent, schedule.remainingMonths) : null,
    annualRatePercent,
    remainingMonths: schedule?.remainingMonths ?? null,
    nextPaymentDate: schedule ? toIsoDate(schedule.nextPaymentDate) : null,
  };
}

/** What is still owed. TBC may sign it negative, as a liability. */
function loanOutstanding(balances: readonly TbcLoanBalance[], currency: CurrencyCode): number {
  const inCurrency = balances.filter((balance) => (balance.balanceAmount?.currency ?? currency) === currency);
  const amount = amountOfType(inCurrency, loanBalanceTypes) ?? parseAmount(inCurrency[0]?.balanceAmount?.amount);
  return Math.abs(amount ?? 0);
}

/**
 * TBC's loan resource has contract dates but no schedule. This assumes monthly instalments on the contract
 * start's day of the month, the last one on the contract end date, and finds the first one after today.
 */
function paymentSchedule(loan: TbcLoan, today: Date): { nextPaymentDate: Date; remainingMonths: number } | null {
  const start = parseIsoDate(loan.relatedDates?.contractStartDate);
  const end = parseIsoDate(loan.relatedDates?.contractEndDate);
  if (!start || !end) return null;
  let monthsFromStart = Math.max(1, calendarMonthsBetween(start, today));
  let next = addMonths(start, monthsFromStart);
  while (next <= today) next = addMonths(start, ++monthsFromStart);
  if (next > end) return null;
  return { nextPaymentDate: next, remainingMonths: calendarMonthsBetween(next, end) + 1 };
}

/** The equal monthly instalment that repays `principal` over `months` at a nominal annual rate. */
export function annuityPayment(principal: number, annualRatePercent: number, months: number): number {
  const monthlyRate = annualRatePercent / 1200;
  const payment = monthlyRate === 0 ? principal / months : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
  return roundMoney(payment);
}

// MARK: Values

function parseMoney(value: { currency?: string; amount?: string } | undefined): Money | null {
  const amount = parseAmount(value?.amount);
  const currency = value?.currency;
  return amount !== null && amount !== 0 && isCurrencyCode(currency) ? { amount, currency } : null;
}

function parseAmount(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? roundMoney(amount) : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyBalance(currency: CurrencyCode): CurrencyBalance {
  return { currency, booked: 0, available: null };
}

function isCurrencyCode(value: string | undefined): value is CurrencyCode {
  return value !== undefined && supportedCurrencies.has(value);
}

function isMultiCurrency(currency: string | undefined): boolean {
  return !currency || currency === multiCurrency;
}

function isClosed(status: string | undefined): boolean {
  return status?.toLowerCase() === 'deleted';
}

function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

function collapseWhitespace(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function lastPathSegment(href: string | undefined): string | undefined {
  return href?.split('?')[0].split('/').filter(Boolean).pop();
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
