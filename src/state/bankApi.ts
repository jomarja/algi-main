import type { BankConnectionStatus, BankSnapshot } from '../../shared/bank.ts';

/**
 * TBC Open Banking as the store sees it. Implemented over HTTP in src/api/bank.ts (see the contract in
 * shared/bank.ts); tests pass a fake. Methods reject on network or server errors.
 */
export interface BankApi {
  status(): Promise<BankConnectionStatus>;
  /** Starts the PSD2 consent; the app navigates to the returned URL. */
  connect(language: 'en' | 'ka'): Promise<{ authorizeUrl: string }>;
  /** The latest bank data; `refresh` asks the server to re-fetch from TBC instead of using its cache. */
  snapshot(refresh?: boolean): Promise<BankSnapshot>;
  /** Deletes the consent at the bank. */
  disconnect(): Promise<void>;
}
