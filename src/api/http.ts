/** Same-origin JSON requests to the Algi server, with timeouts and typed errors. */

export type ApiErrorKind =
  /** The server answered with a non-2xx status. */
  | 'http'
  /** No answer: offline, DNS, connection reset. */
  | 'network'
  /** No answer in time. */
  | 'timeout'
  /** The caller cancelled through its AbortSignal. */
  | 'aborted'
  /** The answer wasn't what the contract promises, e.g. not JSON. */
  | 'invalid_response'
  /** A streamed answer reported a failure part-way through. */
  | 'stream';

interface ApiErrorDetails {
  status?: number;
  code?: string;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, or 0 when there was no HTTP answer. */
  readonly status: number;
  /** The server's machine-readable code (e.g. 'not_connected'), or the kind when the server sent none. */
  readonly code: string;

  constructor(kind: ApiErrorKind, message: string, details: ApiErrorDetails = {}) {
    super(message, { cause: details.cause });
    this.name = 'ApiError';
    this.kind = kind;
    this.status = details.status ?? 0;
    this.code = details.code ?? kind;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  /** Fails with a 'timeout' ApiError if the response headers haven't arrived by then. */
  timeoutMs?: number;
  signal?: AbortSignal;
  accept?: string;
}

const defaultTimeoutMs = 15_000;

interface ErrorBody {
  error: string;
  message?: string;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).error === 'string';
}

async function httpError(response: Response, label: string): Promise<ApiError> {
  let code = `http_${response.status}`;
  let message = `${label} failed with status ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (isErrorBody(body)) {
      code = body.error;
      message = body.message ?? message;
    }
  } catch {
    // Not JSON (e.g. a proxy's HTML error page): the status says enough.
  }
  return new ApiError('http', message, { status: response.status, code });
}

/**
 * Sends a request and resolves once the response headers arrive; non-2xx answers reject with an ApiError.
 * The caller's signal can still cancel reading the body afterwards (for streams).
 */
export async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, timeoutMs = defaultTimeoutMs, signal, accept = 'application/json' } = options;
  const label = `${method} ${path}`;
  const controller = new AbortController();
  let hasTimedOut = false;
  const timer = setTimeout(() => {
    hasTimedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const headers: Record<string, string> = { Accept: accept };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok) throw await httpError(response, label);
    return response;
  } catch (error) {
    signal?.removeEventListener('abort', forwardAbort);
    if (error instanceof ApiError) throw error;
    if (hasTimedOut) throw new ApiError('timeout', `${label} timed out after ${timeoutMs} ms`, { cause: error });
    if (controller.signal.aborted) throw new ApiError('aborted', `${label} was cancelled`, { cause: error });
    throw new ApiError('network', `${label} could not reach the server`, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/** Sends a request and parses the JSON answer, trusting it to match the shared contract type `T`. */
export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ApiError('invalid_response', `${options.method ?? 'GET'} ${path} did not answer with JSON`, {
      status: response.status,
      cause: error,
    });
  }
}
