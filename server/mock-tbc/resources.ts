import { parseIsoDate } from '../openbanking/dates.ts';
import type { TbcLinks, TbcTransactionReport } from '../openbanking/tbc-types.ts';
import type { Persona, PersonaReport } from './persona.ts';
import type { MockRequest, MockResponse } from './responses.ts';
import { formatError, instanceOf, json, mockTbcBasePath, problem } from './responses.ts';

/** The mock's AIS, loans and savings resources: the persona's data in TBC's response shapes, paged like TBC. */

const transactionsPerPage = 50;
const bookingStatuses = ['booked', 'pending', 'both'] as const;

type BookingStatus = (typeof bookingStatuses)[number];

interface ReportQuery {
  bookingStatus: BookingStatus;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
}

interface Dated {
  bookingDate?: string;
  valueDate?: string;
  transactionDate?: string;
}

/** The resource a transaction report belongs to, linked from the report as TBC does. */
interface ReportOwner {
  linkName: 'account' | 'cardAccount';
  path: string;
}

export function listAccounts(persona: Persona, request: MockRequest): MockResponse {
  const withBalance = request.query.get('withBalance') === 'true';
  return json(200, { accounts: persona.accounts().map((account) => (withBalance ? account : { ...account, balances: undefined })) });
}

export function accountBalances(persona: Persona, request: MockRequest, accountId: string): MockResponse {
  return jsonOrNotFound(persona.balances(accountId), request);
}

export function accountTransactions(persona: Persona, request: MockRequest, accountId: string): MockResponse {
  const report = persona.accountReport(accountId);
  if (!report) return resourceNotFound(request);
  const owner: ReportOwner = { linkName: 'account', path: `${mockTbcBasePath}/0.8/v1/accounts/${accountId}` };
  return transactionsResponse(request, report, owner, (page) => ({ account: report.reference, transactions: page }));
}

export function listCardAccounts(persona: Persona, request: MockRequest): MockResponse {
  const withBalance = request.query.get('withBalance') === 'true';
  return json(200, { cardAccounts: persona.cardAccounts().map((card) => (withBalance ? card : { ...card, balances: undefined })) });
}

export function cardTransactions(persona: Persona, request: MockRequest, cardId: string): MockResponse {
  const report = persona.cardReport(cardId);
  if (!report) return resourceNotFound(request);
  const owner: ReportOwner = { linkName: 'cardAccount', path: `${mockTbcBasePath}/0.8/v1/card-accounts/${cardId}` };
  return transactionsResponse(request, report, owner, (page) => ({ cardAccount: report.reference, cardTransactions: page }));
}

export function listLoans(persona: Persona): MockResponse {
  return json(200, { accounts: persona.loans() });
}

export function loanBalances(persona: Persona, request: MockRequest, loanId: string): MockResponse {
  const balances = persona.loanBalances(loanId);
  return jsonOrNotFound(balances && { balances }, request);
}

export function listSavings(persona: Persona): MockResponse {
  return json(200, { accounts: persona.savings() });
}

/** Filters a report by the query and returns one page of it, with a `next` link while more follow. */
function transactionsResponse<T extends Dated>(
  request: MockRequest,
  report: PersonaReport<T>,
  owner: ReportOwner,
  body: (page: TbcTransactionReport<T>) => unknown,
): MockResponse {
  const query = parseReportQuery(request.query);
  if (typeof query === 'string') return formatError(query, instanceOf(request));
  const inRange = (item: T) => {
    const date = (item.bookingDate ?? item.valueDate ?? item.transactionDate ?? '').slice(0, 10);
    return (!query.dateFrom || date >= query.dateFrom) && (!query.dateTo || date <= query.dateTo);
  };
  const booked = query.bookingStatus === 'pending' ? [] : report.booked.filter(inRange);
  const pending = query.bookingStatus === 'booked' || query.page > 1 ? [] : report.pending.filter(inRange);
  const start = (query.page - 1) * transactionsPerPage;
  const page: TbcTransactionReport<T> = {
    booked: booked.slice(start, start + transactionsPerPage),
    pending,
    _links: pageLinks(owner, request.query, query.page, booked.length > start + transactionsPerPage),
  };
  return json(200, body(page));
}

function parseReportQuery(query: URLSearchParams): ReportQuery | string {
  const bookingStatus = bookingStatuses.find((status) => status === query.get('bookingStatus'));
  if (!bookingStatus) return 'bookingStatus must be booked, pending or both.';
  const dateFrom = query.get('dateFrom');
  const dateTo = query.get('dateTo');
  if ((dateFrom && !parseIsoDate(dateFrom)) || (dateTo && !parseIsoDate(dateTo))) return 'dateFrom and dateTo must be dates.';
  const page = Number(query.get('page') ?? '1');
  if (!Number.isInteger(page) || page < 1) return 'page must be a positive whole number.';
  return { bookingStatus, dateFrom: dateFrom ? dateFrom.slice(0, 10) : null, dateTo: dateTo ? dateTo.slice(0, 10) : null, page };
}

function pageLinks(owner: ReportOwner, query: URLSearchParams, page: number, hasMore: boolean): TbcLinks {
  const href = (pageNumber: number) => {
    const params = new URLSearchParams(query);
    params.delete('page');
    if (pageNumber > 1) params.set('page', String(pageNumber));
    return `${owner.path}/transactions?${params}`;
  };
  return {
    [owner.linkName]: { href: owner.path },
    first: { href: href(1) },
    ...(hasMore ? { next: { href: href(page + 1) } } : {}),
  };
}

function jsonOrNotFound(body: object | null, request: MockRequest): MockResponse {
  return body ? json(200, body) : resourceNotFound(request);
}

function resourceNotFound(request: MockRequest): MockResponse {
  return problem(404, 'RESOURCE_UNKNOWN', 'Resource not found', 'No resource with this ID is covered by the consent.', instanceOf(request));
}
