import type {
  BankConnectRequest,
  BankConnectResponse,
  BankConnectionStatus,
  BankSnapshot,
} from '../../shared/bank.ts';
import type { BankApi } from '../state/bankApi.ts';
import { ApiError, requestJson, send } from './http.ts';

/** Reading from TBC can take a while on a refresh, so snapshots get more time than other calls. */
const snapshotTimeoutMs = 30_000;

/** The bank endpoints of server/index.ts (contract at the bottom of shared/bank.ts). */
export class HttpBankApi implements BankApi {
  status(): Promise<BankConnectionStatus> {
    return requestJson<BankConnectionStatus>('/api/bank/status');
  }

  /** Creates the consent; send the user to `authorizeUrl` with `redirectToBankConsent`. */
  connect(language: BankConnectRequest['language']): Promise<BankConnectResponse> {
    const body: BankConnectRequest = { language };
    return requestJson<BankConnectResponse>('/api/bank/connect', { method: 'POST', body });
  }

  /** The latest data; `refresh` reads TBC again instead of the server's short cache. Rejects 401 'not_connected'. */
  snapshot(refresh = false): Promise<BankSnapshot> {
    const path = refresh ? '/api/bank/snapshot?refresh=1' : '/api/bank/snapshot';
    return requestJson<BankSnapshot>(path, { timeoutMs: snapshotTimeoutMs });
  }

  /** Deletes the consent at the bank. */
  async disconnect(): Promise<void> {
    await send('/api/bank/connection', { method: 'DELETE' });
  }
}

/** True when the server says no bank is connected (or TBC stopped accepting the consent). */
export function isNotConnected(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'not_connected';
}
