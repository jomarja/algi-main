import { HttpError } from '../http.ts';
import type { TbcProblem } from './tbc-types.ts';

/**
 * TBC answered with an error status. Keeps the problem's machine-readable code and trace ID only: `detail`
 * can echo identifiers, so it is neither logged nor passed to the browser.
 */
export class TbcApiError extends Error {
  readonly operation: string;
  readonly status: number;
  /** TBC's `code` (CONSENT_INVALID, TOKEN_EXPIRED, ...), OAuth's `error`, or HTTP_<status> when absent. */
  readonly code: string;
  readonly traceId: string | null;

  constructor(operation: string, status: number, problem: TbcProblem | null) {
    const code = problem?.code || problem?.error || `HTTP_${status}`;
    const traceId = problem?.traceId || null;
    super(`TBC ${operation} failed: ${status} ${code}${traceId ? ` (trace ${traceId})` : ''}`);
    this.name = 'TbcApiError';
    this.operation = operation;
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

/** TBC could not be reached, or answered with something other than the documented payload. */
export class TbcProtocolError extends Error {
  readonly operation: string;

  constructor(operation: string, reason: string, options?: { cause?: unknown }) {
    super(`TBC ${operation}: ${reason}`, options);
    this.name = 'TbcProtocolError';
    this.operation = operation;
  }
}

export type TbcError = TbcApiError | TbcProtocolError;

export function isTbcError(error: unknown): error is TbcError {
  return error instanceof TbcApiError || error instanceof TbcProtocolError;
}

const consentProblemCodes: ReadonlySet<string> = new Set(['CONSENT_INVALID', 'CONSENT_UNKNOWN', 'CONSENT_EXPIRED']);

/** TBC no longer accepts the consent (revoked, expired, unknown or without the needed access). */
export function isConsentRejected(error: unknown): boolean {
  return error instanceof TbcApiError && consentProblemCodes.has(error.code);
}

/** A 401 about the access token itself (TOKEN_EXPIRED, TOKEN_INVALID, ...), which a refresh can fix. */
export function isAccessTokenRejected(error: unknown): boolean {
  return error instanceof TbcApiError && error.status === 401 && !consentProblemCodes.has(error.code);
}

/** Loans and savings sit outside the AIS consent: these statuses mean "not offered for this consent". */
export function isProductUnavailable(error: unknown): boolean {
  return error instanceof TbcApiError && [401, 403, 404].includes(error.status);
}

/** The JSON error the browser gets for a failed TBC call. */
export function bankErrorToHttp(error: TbcError): HttpError {
  if (error instanceof TbcProtocolError) {
    return new HttpError(502, 'bank_unreachable', 'TBC Open Banking could not be reached. Try again in a moment.');
  }
  if (isConsentRejected(error) || error.status === 401) {
    return new HttpError(401, 'not_connected', 'TBC no longer accepts this connection. Connect the bank again.');
  }
  if (error.status === 429) {
    return new HttpError(503, 'bank_rate_limited', 'TBC limits how often account data can be read. Try again later.');
  }
  if (error.status >= 500) {
    return new HttpError(502, 'bank_unavailable', 'TBC Open Banking is not available right now. Try again later.');
  }
  return new HttpError(502, 'bank_request_rejected', 'TBC rejected the request.');
}
