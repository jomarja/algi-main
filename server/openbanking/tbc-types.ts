/**
 * TBC Open Banking payloads, as documented in TBC's OpenAPI specs: NextGenPSD2 1.3.6 AIS (consents, OAuth,
 * accounts, card accounts) and the separate Loans and Savings service (/v2/loans, /v2/savings).
 *
 * Response fields are all optional: they describe untrusted bank data and the normaliser checks what it uses.
 * Amounts are decimal strings ("-50.00"), except loan balances, which TBC documents as numbers.
 */

export interface TbcHref {
  href?: string;
}

export type TbcLinks = Partial<Record<string, TbcHref>>;

export interface TbcAmount {
  currency?: string;
  amount?: string;
}

export interface TbcBalance {
  /** interimBooked, interimAvailable, closingBooked, openingBooked, expected, forwardAvailable (savings use PascalCase). */
  balanceType?: string;
  balanceAmount?: TbcAmount;
  creditLimitIncluded?: boolean;
  referenceDate?: string;
  lastChangeDateTime?: string;
}

export interface TbcAccountReference {
  iban?: string;
  maskedPan?: string;
  currency?: string;
}

export interface TbcAccount {
  resourceId?: string;
  iban?: string;
  /** An ISO currency, or "XXX" for a multi-currency (aggregation) account holding several currency balances. */
  currency?: string;
  ownerName?: string;
  name?: string;
  displayName?: string;
  product?: string;
  /** CARD, CACC, SVGS, ... (ISO 20022 cash account type). */
  cashAccountType?: string;
  status?: string;
  bic?: string;
  usage?: string;
  balances?: TbcBalance[];
  /** `aggregationAccount` points a per-currency sub-account at its multi-currency account. */
  _links?: TbcLinks;
}

export interface TbcAccountsResponse {
  accounts?: TbcAccount[];
}

export interface TbcBalancesResponse {
  account?: TbcAccountReference;
  balances?: TbcBalance[];
}

export interface TbcTransaction {
  transactionId?: string;
  entryReference?: string;
  creditorName?: string;
  creditorAccount?: TbcAccountReference;
  debtorName?: string;
  debtorAccount?: TbcAccountReference;
  /** Negative for money leaving the account. */
  transactionAmount?: TbcAmount;
  bookingDate?: string;
  valueDate?: string;
  remittanceInformationUnstructured?: string;
  additionalInformation?: string;
  proprietaryBankTransactionCode?: string;
}

export interface TbcTransactionReport<T> {
  booked?: T[];
  pending?: T[];
  /** `next` is present while more pages follow. */
  _links?: TbcLinks;
}

export interface TbcTransactionsResponse {
  account?: TbcAccountReference;
  transactions?: TbcTransactionReport<TbcTransaction>;
}

/** All pages of one account's transaction report, merged. */
export interface TbcTransactionLists<T> {
  booked: T[];
  pending: T[];
}

export interface TbcCardAccount {
  resourceId?: string;
  maskedPan?: string;
  currency?: string;
  ownerName?: string;
  name?: string;
  displayName?: string;
  product?: string;
  status?: string;
  usage?: string;
  creditLimit?: string;
  balances?: TbcBalance[];
  _links?: TbcLinks;
}

export interface TbcCardAccountsResponse {
  cardAccounts?: TbcCardAccount[];
}

export interface TbcCardTransaction {
  cardTransactionId?: string;
  transactionDate?: string;
  bookingDate?: string;
  transactionAmount?: TbcAmount;
  transactionDetails?: string;
  maskedPan?: string;
  proprietaryBankTransactionCode?: string;
}

export interface TbcCardTransactionsResponse {
  cardAccount?: TbcAccountReference;
  cardTransactions?: TbcTransactionReport<TbcCardTransaction>;
}

export interface TbcLoanBalance {
  balanceAmount?: { currency?: string; amount?: number | string };
  /** ClosingBooked, OpeningBooked, ForwardAvailable, InterimBooked or Information. */
  balanceType?: string;
  balanceSubTypeProprietary?: string | null;
  referenceDate?: string;
}

export interface TbcLoan {
  resourceId?: string;
  currency?: string;
  relatedDates?: { contractStartDate?: string; contractEndDate?: string };
  balances?: TbcLoanBalance[] | null;
  /** Enabled or Deleted. */
  status?: string;
  interest?: { rate?: { percentage?: number } };
  product?: string;
  _links?: TbcLinks;
}

export interface TbcLoansResponse {
  accounts?: TbcLoan[] | null;
}

export interface TbcLoanBalancesResponse {
  balances?: TbcLoanBalance[] | null;
}

export interface TbcSavingsAccount {
  resourceId?: string;
  product?: string;
  currency?: string;
  status?: string;
  period?: number | null;
  contractStartDate?: string;
  ownerName?: string;
  cashAccountType?: string;
  balances?: TbcBalance[] | null;
  links?: TbcLinks;
}

export interface TbcSavingsResponse {
  accounts?: TbcSavingsAccount[] | null;
}

/**
 * A bank-offered consent: empty lists let the PSU choose the accounts while authorising at TBC.
 * The capitalised keys follow TBC's own request example for this consent type.
 */
export interface TbcConsentRequest {
  access: {
    Accounts: TbcAccountReference[];
    Balances: TbcAccountReference[];
    Transactions: TbcAccountReference[];
  };
  recurringIndicator: boolean;
  validUntil: string;
  frequencyPerDay: number;
  combinedServiceIndicator: boolean;
}

export interface TbcConsentResponse {
  consentStatus?: string;
  consentId?: string;
  _links?: TbcLinks;
}

export interface TbcConsentStatusResponse {
  consentStatus?: string;
}

export interface TbcTokenResponse {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  refresh_token_issued_at?: string;
  /** Seconds. TBC's examples send it as a string. */
  refresh_token_expires_in?: string | number;
  refresh_count?: number;
  scope?: string;
  issued_at?: string;
  /** Seconds. A number in TBC's examples, a string in its schema. */
  expires_in?: string | number;
}

/** A token response that carries the access token. */
export type TbcTokenGrant = TbcTokenResponse & { access_token: string };

export interface TbcAuthorizationServerMetadata {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
  tls_client_certificate_bound_access_tokens?: boolean;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  ui_locales_supported?: string[];
}

/** TBC's error body: RFC 7807 problem details for AIS, OAuth's `error` fields for the token endpoint. */
export interface TbcProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  code?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
  systemCode?: string;
}
