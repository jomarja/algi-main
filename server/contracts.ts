import type { BankSnapshot } from '../shared/bank.ts';
import type { Session } from './http.ts';

/**
 * What the AI coach needs from the open banking module: the session's latest bank data.
 * Implemented by server/openbanking; consumed by server/ai.
 */
export interface BankDataSource {
  /** The session's bank data, fetched or refreshed from TBC as needed. Null when no bank is connected. */
  snapshot(session: Session): Promise<BankSnapshot | null>;
}
