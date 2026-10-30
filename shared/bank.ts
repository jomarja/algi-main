/**
 * Bank data as the app sees it, normalised from TBC Open Banking (NextGenPSD2 AIS) responses.
 * The server produces these; the browser never sees raw PSD2 payloads, tokens or consent secrets.
 */

export type CurrencyCode = 'GEL' | 'USD' | 'EUR';

/** Mirrors the iOS app's SpendingCategory raw values. */
export type SpendingCategoryId =
  | 'foodDelivery'
  | 'foodAndDrink'
  | 'groceries'
  | 'transport'
  | 'subscriptions'
  | 'shopping'
  | 'utilities'
  | 'health'
  | 'housing'
  | 'debt'
  | 'income';

/** Where the data came from: the built-in mock of TBC's API, or TBC's real sandbox / production. */
export type BankDataSourceKind = 'mock' | 'tbc-sandbox' | 'tbc-production';

export interface BankAccount {
  /** TBC `resourceId`. */
  id: string;
  iban: string;
  /** TBC `displayName`, falling back to `name`. */
  name: string;
  kind: 'current' | 'card' | 'savings';
  currency: CurrencyCode;
  /** Booked balance (`interimBooked`) in major units of `currency`. */
  balance: number;
  /** Available balance (`interimAvailable`), when TBC reports one. */
  available: number | null;
}

export interface BankTransaction {
  /** TBC `transactionId`. */
  id: string;
  accountId: string;
  /** `bookingDate` (or `valueDate` for pending items), YYYY-MM-DD. */
  bookingDate: string;
  /** Always positive, in major units of `currency`. */
  amount: number;
  direction: 'expense' | 'income';
  currency: CurrencyCode;
  /** Counterparty or merchant, cleaned for display. */
  merchant: string;
  /** `remittanceInformationUnstructured` as sent by the bank. */
  description: string;
  category: SpendingCategoryId;
  status: 'booked' | 'pending';
}

export interface BankLoan {
  id: string;
  name: string;
  currency: CurrencyCode;
  outstanding: number;
  monthlyPayment: number | null;
  annualRatePercent: number | null;
  remainingMonths: number | null;
  nextPaymentDate: string | null;
}

export interface BankConsent {
  id: string;
  /** PSD2 consent status: received, valid, rejected, expired, revokedByPsu, terminatedByTpp. */
  status: string;
  /** YYYY-MM-DD. */
  validUntil: string;
}

export interface BankSnapshot {
  source: BankDataSourceKind;
  bank: 'TBC Bank';
  consent: BankConsent;
  accounts: BankAccount[];
  transactions: BankTransaction[];
  loans: BankLoan[];
  /** ISO timestamp of the fetch. */
  fetchedAt: string;
}

export interface BankConnectionStatus {
  connected: boolean;
  source: BankDataSourceKind;
  consent: BankConsent | null;
  lastSyncedAt: string | null;
}

/**
 * HTTP contract, served by server/index.ts:
 *   GET    /api/bank/status                  -> BankConnectionStatus
 *   POST   /api/bank/connect  {language}     -> { authorizeUrl }  (creates the PSD2 consent + PKCE state)
 *   GET    /api/bank/callback?code&state     -> 302 to /?bank=connected  or  /?bank=error&reason=...
 *   GET    /api/bank/snapshot[?refresh=1]    -> BankSnapshot, or 401 { error: 'not_connected' }
 *   DELETE /api/bank/connection              -> 204  (deletes the consent at the bank)
 */
export interface BankConnectRequest {
  language: 'en' | 'ka';
}

export interface BankConnectResponse {
  authorizeUrl: string;
}
