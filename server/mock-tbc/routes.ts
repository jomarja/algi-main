import type { ServerConfig } from '../config.ts';
import type { Handler, RouteParams, Router } from '../http.ts';
import { matchSegments, readBody } from '../http.ts';
import { flattenHeaders } from '../openbanking/transport.ts';
import { MockAuthorizationServer } from './authorization.ts';
import { Persona, consentScreenAccounts } from './persona.ts';
import {
  accountBalances,
  accountTransactions,
  cardTransactions,
  listAccounts,
  listCardAccounts,
  listLoans,
  listSavings,
  loanBalances,
} from './resources.ts';
import type { MockRequest, MockResponse } from './responses.ts';
import { instanceOf, mockRequestFrom, mockTbcBasePath, problem } from './responses.ts';

/**
 * A built-in imitation of TBC's Open Banking sandbox, so the whole app works without credentials: the same
 * paths (TBC's hosts become /mock-tbc), payloads, status codes and validation, serving a demo persona.
 */

export type MockTbcHandler = (request: MockRequest) => MockResponse;

type MockRouteHandler = (request: MockRequest, params: RouteParams) => MockResponse;

interface MockRoute {
  method: string;
  segments: string[];
  handle: MockRouteHandler;
}

export function registerMockTbcRoutes(router: Router, config: ServerConfig): void {
  const handle = createMockTbcHandler(config);
  const forward: Handler = async ({ req, res, url }) => {
    const method = req.method ?? 'GET';
    const body = method === 'POST' ? await readBody(req) : '';
    const response = handle(mockRequestFrom(method, url, flattenHeaders(req.headers), body));
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  };
  router.get(`${mockTbcBasePath}/*`, forward);
  router.post(`${mockTbcBasePath}/*`, forward);
  router.delete(`${mockTbcBasePath}/*`, forward);
}

/** The mock bank as a function of requests, so tests can call it without a server. */
export function createMockTbcHandler(config: ServerConfig, now: () => Date = () => new Date()): MockTbcHandler {
  const auth = new MockAuthorizationServer(config.tbc, now);
  const persona = () => new Persona(now());
  const ais = (handle: MockRouteHandler): MockRouteHandler => (request, params) =>
    auth.authorizeResource(request, request.headers['consent-id']) ?? handle(request, params);
  // TBC's loans and savings service expects the consent in a header named `consentId`.
  const product = (handle: MockRouteHandler): MockRouteHandler => (request, params) =>
    auth.authorizeResource(request, request.headers.consentid) ?? handle(request, params);

  const routes: MockRoute[] = [
    route('POST', '0.8/v1/consents', (request) => auth.createConsent(request)),
    route('GET', '0.8/v1/consents/:consentId/status', (request, { consentId }) => auth.consentStatus(request, consentId)),
    route('DELETE', '0.8/v1/consents/:consentId', (request, { consentId }) => auth.deleteConsent(request, consentId)),
    route('GET', '.well-known/oauth-authorization-server', () => auth.metadata()),
    route('GET', 'psd2/openbanking/oauth/authorize', (request) => auth.authorize(request)),
    route('GET', 'loginapp/session', (request) => auth.loginPage(request, consentScreenAccounts)),
    route('POST', 'loginapp/session', (request) => auth.decide(request)),
    route('POST', 'openbanking/oauth/token', (request) => auth.token(request)),
    route('GET', '0.8/v1/accounts', ais((request) => listAccounts(persona(), request))),
    route('GET', '0.8/v1/accounts/:id/balances', ais((request, { id }) => accountBalances(persona(), request, id))),
    route('GET', '0.8/v1/accounts/:id/transactions', ais((request, { id }) => accountTransactions(persona(), request, id))),
    route('GET', '0.8/v1/card-accounts', ais((request) => listCardAccounts(persona(), request))),
    route('GET', '0.8/v1/card-accounts/:id/transactions', ais((request, { id }) => cardTransactions(persona(), request, id))),
    route('GET', 'v2/loans', product(() => listLoans(persona()))),
    route('GET', 'v2/loans/:id/balances', product((request, { id }) => loanBalances(persona(), request, id))),
    route('GET', 'v2/savings', product(() => listSavings(persona()))),
  ];

  return (request) => {
    const response = dispatch(routes, request);
    const requestId = request.headers['x-request-id'];
    return requestId ? { ...response, headers: { ...response.headers, 'X-Request-ID': requestId } } : response;
  };
}

function route(method: string, pattern: string, handle: MockRouteHandler): MockRoute {
  return { method, segments: pattern.split('/').filter(Boolean), handle };
}

function dispatch(routes: readonly MockRoute[], request: MockRequest): MockResponse {
  for (const candidate of routes) {
    if (candidate.method !== request.method) continue;
    const params = matchSegments(candidate.segments, request.segments);
    if (params) return candidate.handle(request, params);
  }
  return problem(404, 'RESOURCE_UNKNOWN', 'Not found', 'The TBC mock has no such endpoint.', instanceOf(request));
}
