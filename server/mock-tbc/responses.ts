import { randomBytes } from 'node:crypto';

/** Request and response shapes of the mock bank, and builders for TBC's response formats. */

/** Where the mock is mounted, the counterpart of TBC's hosts. */
export const mockTbcBasePath = '/mock-tbc';

export interface MockRequest {
  method: string;
  /** Path segments after the mount point, e.g. ['0.8', 'v1', 'accounts']. */
  segments: string[];
  query: URLSearchParams;
  /** Lower-case header names. */
  headers: Record<string, string>;
  body: string;
}

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function mockRequestFrom(method: string, url: URL, headers: Record<string, string>, body: string): MockRequest {
  const mountSegments = mockTbcBasePath.split('/').filter(Boolean).length;
  return {
    method,
    segments: url.pathname.split('/').filter(Boolean).slice(mountSegments),
    query: url.searchParams,
    headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])),
    body,
  };
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): MockResponse {
  return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }, body: JSON.stringify(body) };
}

/** TBC's RFC 7807 error body, as in its 4xx/5xx examples. */
export function problem(status: number, code: string, title: string, detail: string, instance: string): MockResponse {
  const body = {
    code,
    traceId: `00-${randomBytes(16).toString('hex')}-${randomBytes(8).toString('hex')}-01`,
    type: `https://developers.tbcbank.ge/docs/error-type-${status}`,
    title,
    status,
    detail,
    instance,
  };
  return { status, headers: { 'Content-Type': 'application/problem+json; charset=utf-8' }, body: JSON.stringify(body) };
}

export function formatError(detail: string, instance: string): MockResponse {
  return problem(400, 'FORMAT_ERROR', 'Invalid Request', detail, instance);
}

/** The token endpoint's error body, as in TBC's examples. */
export function oauthError(status: number, error: string, description: string): MockResponse {
  return json(status, {
    error,
    error_uri: `https://developers.tbcbank.ge/docs/error-type-${status}`,
    error_description: description,
    systemCode: `System code for problem is psd2_oauth.${status}.001`,
  });
}

export function redirectTo(location: string): MockResponse {
  return { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' }, body: '' };
}

export function html(status: number, body: string, headers: Record<string, string> = {}): MockResponse {
  return {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', ...headers },
    body,
  };
}

/** The `instance` of a problem: the path as TBC reports it, without the API version prefix. */
export function instanceOf(request: MockRequest): string {
  const segments = request.segments[0] === '0.8' ? request.segments.slice(1) : request.segments;
  return `/${segments.join('/')}`;
}

/** `url` with `params` added; empty values are left out. */
export function withQuery(url: string, params: Record<string, string | null | undefined>): string {
  const target = new URL(url);
  for (const [name, value] of Object.entries(params)) {
    if (value) target.searchParams.set(name, value);
  }
  return target.toString();
}
