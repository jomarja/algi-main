import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BankConnectionStatus, BankConnectResponse, BankSnapshot } from '../../shared/bank.ts';
import { loadConfig } from '../config.ts';
import { HttpError, Router, Session } from '../http.ts';
import { MockBankDriver, testPsuIpAddress } from '../mock-tbc/mock-bank-driver.ts';
import { parseConnectRequest, registerBankRoutes } from './routes.ts';
import { BankService } from './service.ts';
import { TbcClient } from './tbc-client.ts';

const config = loadConfig({ TBC_MODE: 'mock', PORT: '8787', PUBLIC_BASE_URL: 'http://localhost:5173' });
const now = () => new Date('2026-10-29T09:00:00Z');

/** Captures what a handler writes. */
class RecordedResponse {
  status = 0;
  headers: Record<string, string | number> = {};
  body = '';

  writeHead(status: number, headers: Record<string, string | number> = {}): this {
    this.status = status;
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }

  end(body?: string): this {
    this.body = body ?? '';
    return this;
  }

  json<T>(): T {
    return JSON.parse(this.body) as T;
  }
}

let router: Router;
let session: Session;
let bank: MockBankDriver;

async function request(method: string, path: string, body = ''): Promise<RecordedResponse> {
  const req = Object.assign(Readable.from(body ? [Buffer.from(body)] : []), {
    method,
    url: path,
    headers: { 'x-forwarded-for': testPsuIpAddress },
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage;
  const res = new RecordedResponse();
  const handled = await router.handle({ req, res: res as unknown as ServerResponse, url: new URL(path, config.internalBaseUrl), session });
  expect(handled).toBe(true);
  return res;
}

beforeEach(() => {
  bank = new MockBankDriver(config, now);
  router = new Router();
  session = new Session('session-1');
  registerBankRoutes(router, new BankService({ tbc: config.tbc, client: new TbcClient(config.tbc, bank.transport()), now }));
});

describe('bank routes', () => {
  it('GET /api/bank/status reports no connection yet', async () => {
    const response = await request('GET', '/api/bank/status');

    expect(response.status).toBe(200);
    expect(response.json<BankConnectionStatus>()).toEqual({ connected: false, source: 'mock', consent: null, lastSyncedAt: null });
  });

  it('GET /api/bank/snapshot answers 401 not_connected without a connection', async () => {
    await expect(request('GET', '/api/bank/snapshot')).rejects.toMatchObject({ status: 401, code: 'not_connected' });
  });

  it('connects, completes the callback with a redirect, and serves the snapshot', async () => {
    const connected = await request('POST', '/api/bank/connect', JSON.stringify({ language: 'ka' }));
    const { authorizeUrl } = connected.json<BankConnectResponse>();
    expect(new URL(authorizeUrl).searchParams.get('ui_locales')).toBe('ka');

    const callback = bank.authoriseInBrowser(authorizeUrl, 'approve');
    const redirected = await request('GET', `/api/bank/callback?${callback}`);
    expect(redirected.status).toBe(302);
    expect(redirected.headers.Location).toBe('/?bank=connected');

    const snapshot = await request('GET', '/api/bank/snapshot?refresh=1');
    expect(snapshot.status).toBe(200);
    expect(snapshot.json<BankSnapshot>().accounts[0]).toMatchObject({ name: 'Everyday', currency: 'GEL', balance: 2486.4 });
  });

  it('redirects to an error when the PSU cancels at the bank', async () => {
    const { authorizeUrl } = (await request('POST', '/api/bank/connect', '{}')).json<BankConnectResponse>();
    const callback = bank.authoriseInBrowser(authorizeUrl, 'decline');

    const redirected = await request('GET', `/api/bank/callback?${callback}`);

    expect(redirected.headers.Location).toBe('/?bank=error&reason=access_denied');
  });

  it('DELETE /api/bank/connection answers 204 and disconnects', async () => {
    const { authorizeUrl } = (await request('POST', '/api/bank/connect', '')).json<BankConnectResponse>();
    await request('GET', `/api/bank/callback?${bank.authoriseInBrowser(authorizeUrl, 'approve')}`);

    const deleted = await request('DELETE', '/api/bank/connection');

    expect(deleted.status).toBe(204);
    expect((await request('GET', '/api/bank/status')).json<BankConnectionStatus>().connected).toBe(false);
  });
});

describe('parseConnectRequest', () => {
  it('reads the language', () => {
    expect(parseConnectRequest('{"language":"ka"}')).toEqual({ language: 'ka' });
    expect(parseConnectRequest('{"language":"en"}')).toEqual({ language: 'en' });
  });

  it('defaults to English for an empty body or an unknown language', () => {
    expect(parseConnectRequest('')).toEqual({ language: 'en' });
    expect(parseConnectRequest('{}')).toEqual({ language: 'en' });
    expect(parseConnectRequest('{"language":"ru"}')).toEqual({ language: 'en' });
    expect(parseConnectRequest('null')).toEqual({ language: 'en' });
  });

  it('rejects a body that is not JSON', () => {
    expect(() => parseConnectRequest('language=ka')).toThrow(HttpError);
  });
});
