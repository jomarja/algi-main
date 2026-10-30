import { randomUUID } from 'node:crypto';
import type { TbcConfig } from '../config.ts';
import { TbcApiError, TbcProtocolError, isProductUnavailable } from './errors.ts';
import type { BankLanguage } from './oauth.ts';
import type {
  TbcAccount,
  TbcAccountsResponse,
  TbcBalance,
  TbcBalancesResponse,
  TbcCardAccount,
  TbcCardAccountsResponse,
  TbcCardTransaction,
  TbcCardTransactionsResponse,
  TbcConsentRequest,
  TbcConsentResponse,
  TbcConsentStatusResponse,
  TbcLoan,
  TbcLoanBalance,
  TbcLoanBalancesResponse,
  TbcLoansResponse,
  TbcProblem,
  TbcSavingsAccount,
  TbcSavingsResponse,
  TbcTokenGrant,
  TbcTokenResponse,
  TbcTransaction,
  TbcTransactionLists,
  TbcTransactionReport,
  TbcTransactionsResponse,
} from './tbc-types.ts';
import type { HttpTransport, TransportMethod, TransportResponse } from './transport.ts';

/** What an AIS data call needs: the access token issued for the consent, and the PSU's IP address. */
export interface AisCredentials {
  accessToken: string;
  consentId: string;
  psuIpAddress: string;
}

export interface ConsentRequestInput {
  validUntil: string;
  psuIpAddress: string;
  language: BankLanguage;
}

export interface CreatedConsent {
  consentId: string;
  consentStatus: string;
}

interface ClientRequest {
  method: TransportMethod;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  form?: Record<string, string>;
}

/** Reads per day without the PSU present; 4 is TBC's maximum without a bilateral agreement. */
const frequencyPerDay = 4;
/** Stops a bank that keeps sending `next` links. */
const maxTransactionPages = 100;

/**
 * TBC Open Banking API calls, with the paths, header names and bodies of TBC's specs. Returns TBC's payloads
 * as they are; throws TbcApiError for error statuses and TbcProtocolError when TBC can't be reached or read.
 */
export class TbcClient {
  private readonly tbc: TbcConfig;
  private readonly transport: HttpTransport;
  private readonly newRequestId: () => string;

  constructor(tbc: TbcConfig, transport: HttpTransport, newRequestId: () => string = randomUUID) {
    this.tbc = tbc;
    this.transport = transport;
    this.newRequestId = newRequestId;
  }

  // MARK: Consents

  async createConsent(input: ConsentRequestInput): Promise<CreatedConsent> {
    const body: TbcConsentRequest = {
      access: { Accounts: [], Balances: [], Transactions: [] },
      recurringIndicator: true,
      validUntil: input.validUntil,
      frequencyPerDay,
      combinedServiceIndicator: false,
    };
    const response = await this.request<TbcConsentResponse>('createConsent', {
      method: 'POST',
      url: `${this.tbc.apiBaseUrl}/v1/consents`,
      headers: {
        'PSU-IP-Address': input.psuIpAddress,
        'TPP-Redirect-URI': this.tbc.redirectUri,
        'Accept-Language': input.language,
      },
      json: body,
    });
    if (!response.consentId) throw new TbcProtocolError('createConsent', 'the response has no consentId');
    return { consentId: response.consentId, consentStatus: response.consentStatus ?? 'received' };
  }

  async getConsentStatus(consentId: string, psuIpAddress: string): Promise<string> {
    const response = await this.request<TbcConsentStatusResponse>('getConsentStatus', {
      method: 'GET',
      url: `${this.tbc.apiBaseUrl}/v1/consents/${encodeURIComponent(consentId)}/status`,
      headers: { 'PSU-IP-Address': psuIpAddress },
    });
    if (!response.consentStatus) throw new TbcProtocolError('getConsentStatus', 'the response has no consentStatus');
    return response.consentStatus;
  }

  async deleteConsent(credentials: AisCredentials): Promise<void> {
    await this.send('deleteConsent', {
      method: 'DELETE',
      url: `${this.tbc.apiBaseUrl}/v1/consents/${encodeURIComponent(credentials.consentId)}`,
      headers: { Authorization: `Bearer ${credentials.accessToken}`, 'PSU-IP-Address': credentials.psuIpAddress },
    });
  }

  // MARK: OAuth tokens. TBC authenticates the client by its QWAC certificate (tls_client_auth): no secret is sent.

  exchangeAuthorizationCode(code: string, codeVerifier: string): Promise<TbcTokenGrant> {
    return this.requestToken('exchangeAuthorizationCode', {
      client_id: this.tbc.clientId,
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.tbc.redirectUri,
    });
  }

  refreshAccessToken(refreshToken: string): Promise<TbcTokenGrant> {
    return this.requestToken('refreshAccessToken', {
      client_id: this.tbc.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async requestToken(operation: string, form: Record<string, string>): Promise<TbcTokenGrant> {
    const response = await this.request<TbcTokenResponse>(operation, { method: 'POST', url: this.tbc.tokenUrl, form });
    if (!response.access_token) throw new TbcProtocolError(operation, 'the response has no access_token');
    return { ...response, access_token: response.access_token };
  }

  // MARK: Accounts and card accounts

  async listAccounts(credentials: AisCredentials): Promise<TbcAccount[]> {
    const request = this.aisGet(credentials, '/v1/accounts?withBalance=true');
    return (await this.request<TbcAccountsResponse>('listAccounts', request)).accounts ?? [];
  }

  async getAccountBalances(credentials: AisCredentials, accountId: string): Promise<TbcBalance[]> {
    const request = this.aisGet(credentials, `/v1/accounts/${encodeURIComponent(accountId)}/balances`);
    return (await this.request<TbcBalancesResponse>('getAccountBalances', request)).balances ?? [];
  }

  listAccountTransactions(
    credentials: AisCredentials,
    accountId: string,
    dateFrom: string,
  ): Promise<TbcTransactionLists<TbcTransaction>> {
    const path = `/v1/accounts/${encodeURIComponent(accountId)}/transactions?${transactionQuery(dateFrom)}`;
    return this.collectPages('listAccountTransactions', credentials, path, (page: TbcTransactionsResponse) => page.transactions);
  }

  async listCardAccounts(credentials: AisCredentials): Promise<TbcCardAccount[]> {
    const request = this.aisGet(credentials, '/v1/card-accounts?withBalance=true');
    return (await this.request<TbcCardAccountsResponse>('listCardAccounts', request)).cardAccounts ?? [];
  }

  listCardAccountTransactions(
    credentials: AisCredentials,
    accountId: string,
    dateFrom: string,
  ): Promise<TbcTransactionLists<TbcCardTransaction>> {
    const path = `/v1/card-accounts/${encodeURIComponent(accountId)}/transactions?${transactionQuery(dateFrom)}`;
    return this.collectPages('listCardAccountTransactions', credentials, path, (page: TbcCardTransactionsResponse) => page.cardTransactions);
  }

  private aisGet(credentials: AisCredentials, path: string): ClientRequest {
    return { method: 'GET', url: `${this.tbc.apiBaseUrl}${path}`, headers: aisHeaders(credentials) };
  }

  /** Reads every page of a transaction report, following `_links.next`. */
  private async collectPages<Page, T>(
    operation: string,
    credentials: AisCredentials,
    firstPath: string,
    reportOf: (page: Page) => TbcTransactionReport<T> | undefined,
  ): Promise<TbcTransactionLists<T>> {
    const lists: TbcTransactionLists<T> = { booked: [], pending: [] };
    const visited = new Set<string>();
    let url: string | null = `${this.tbc.apiBaseUrl}${firstPath}`;
    while (url) {
      if (visited.has(url) || visited.size >= maxTransactionPages) {
        throw new TbcProtocolError(operation, 'transaction paging does not end');
      }
      visited.add(url);
      const report = reportOf(await this.request<Page>(operation, { method: 'GET', url, headers: aisHeaders(credentials) }));
      lists.booked.push(...(report?.booked ?? []));
      lists.pending.push(...(report?.pending ?? []));
      url = this.nextPageUrl(operation, report?._links?.next?.href);
    }
    return lists;
  }

  /** TBC's links are host-relative ("/0.8/v1/..."). One pointing at another host is refused: it would get the token. */
  private nextPageUrl(operation: string, href: string | undefined): string | null {
    if (!href) return null;
    const base = new URL(this.tbc.apiBaseUrl);
    const next = new URL(href, base);
    if (next.origin !== base.origin) throw new TbcProtocolError(operation, 'a paging link points to another host');
    return next.toString();
  }

  // MARK: Loans and savings: a separate TBC service, so optional. An empty list when the consent doesn't cover it.

  listLoans(credentials: AisCredentials): Promise<TbcLoan[]> {
    return this.optionalProduct(async () => {
      const response = await this.request<TbcLoansResponse>('listLoans', this.productGet(credentials, '/v2/loans'));
      return response.accounts ?? [];
    });
  }

  getLoanBalances(credentials: AisCredentials, loanId: string): Promise<TbcLoanBalance[]> {
    return this.optionalProduct(async () => {
      const request = this.productGet(credentials, `/v2/loans/${encodeURIComponent(loanId)}/balances`);
      return (await this.request<TbcLoanBalancesResponse>('getLoanBalances', request)).balances ?? [];
    });
  }

  listSavings(credentials: AisCredentials): Promise<TbcSavingsAccount[]> {
    return this.optionalProduct(async () => {
      const request = this.productGet(credentials, '/v2/savings?withBalance=true');
      return (await this.request<TbcSavingsResponse>('listSavings', request)).accounts ?? [];
    });
  }

  private productGet(credentials: AisCredentials, path: string): ClientRequest {
    return {
      method: 'GET',
      url: `${this.tbc.productsBaseUrl}${path}`,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        // TBC's loans and savings spec names this header `consentId`, unlike AIS's `Consent-ID`.
        consentId: credentials.consentId,
        'PSU-IP-Address': credentials.psuIpAddress,
      },
    };
  }

  private async optionalProduct<T>(read: () => Promise<T[]>): Promise<T[]> {
    try {
      return await read();
    } catch (error) {
      if (isProductUnavailable(error)) return [];
      throw error;
    }
  }

  // MARK: HTTP

  private async request<T>(operation: string, request: ClientRequest): Promise<T> {
    const response = await this.send(operation, request);
    try {
      return JSON.parse(response.body) as T;
    } catch {
      throw new TbcProtocolError(operation, `the response is not JSON (HTTP ${response.status})`);
    }
  }

  private async send(operation: string, request: ClientRequest): Promise<TransportResponse> {
    const encoded = encodeBody(request);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Request-ID': this.newRequestId(),
      ...request.headers,
      // Set explicitly because request signing covers both.
      ...(encoded ? { 'Content-Type': encoded.contentType, 'Content-Length': String(Buffer.byteLength(encoded.body)) } : {}),
    };
    let response: TransportResponse;
    try {
      response = await this.transport.send({ method: request.method, url: request.url, headers, body: encoded?.body });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TbcProtocolError(operation, `the request failed: ${reason}`, { cause: error });
    }
    if (response.status < 200 || response.status >= 300) {
      throw new TbcApiError(operation, response.status, parseProblem(response.body));
    }
    return response;
  }
}

function aisHeaders(credentials: AisCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${credentials.accessToken}`,
    'Consent-ID': credentials.consentId,
    'PSU-IP-Address': credentials.psuIpAddress,
  };
}

function transactionQuery(dateFrom: string): string {
  return new URLSearchParams({ dateFrom, bookingStatus: 'both' }).toString();
}

function encodeBody(request: ClientRequest): { body: string; contentType: string } | null {
  if (request.json !== undefined) return { body: JSON.stringify(request.json), contentType: 'application/json' };
  if (request.form !== undefined) {
    return { body: new URLSearchParams(request.form).toString(), contentType: 'application/x-www-form-urlencoded' };
  }
  return null;
}

function parseProblem(body: string): TbcProblem | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null ? (parsed as TbcProblem) : null;
  } catch {
    return null;
  }
}
