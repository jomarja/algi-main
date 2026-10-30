import type { BankConnectRequest } from '../../shared/bank.ts';
import type { ServerConfig, TbcConfig } from '../config.ts';
import type { Router } from '../http.ts';
import { HttpError, clientIp, readBody, redirect, sendJson, sendNoContent } from '../http.ts';
import { BankService } from './service.ts';
import { loadSigningCredentials, withRequestSigning } from './signing.ts';
import { TbcClient } from './tbc-client.ts';
import type { HttpTransport } from './transport.ts';
import { createNodeTransport, loadClientTls } from './transport.ts';

export type { BankService };

/** Wires the TBC client for the configured mode: mutual TLS for TBC, request signing when configured. */
export function createBankService(config: ServerConfig): BankService {
  return new BankService({ tbc: config.tbc, client: new TbcClient(config.tbc, createTbcTransport(config.tbc)) });
}

function createTbcTransport(tbc: TbcConfig): HttpTransport {
  const transport = createNodeTransport(loadClientTls(tbc));
  const signing = loadSigningCredentials(tbc);
  return signing ? withRequestSigning(transport, signing) : transport;
}

/** The HTTP contract at the bottom of shared/bank.ts. */
export function registerBankRoutes(router: Router, service: BankService): void {
  router.get('/api/bank/status', ({ res, session }) => {
    sendJson(res, 200, service.status(session));
  });

  router.post('/api/bank/connect', async ({ req, res, session }) => {
    const { language } = parseConnectRequest(await readBody(req));
    sendJson(res, 200, await service.connect(session, language, clientIp(req)));
  });

  router.get('/api/bank/callback', async ({ req, res, url, session }) => {
    redirect(res, await service.completeAuthorisation(session, url.searchParams, clientIp(req)));
  });

  router.get('/api/bank/snapshot', async ({ req, res, url, session }) => {
    const refresh = url.searchParams.get('refresh') === '1';
    const snapshot = await service.snapshot(session, { refresh, psuIpAddress: clientIp(req) });
    if (!snapshot) throw new HttpError(401, 'not_connected', 'No bank is connected.');
    sendJson(res, 200, snapshot);
  });

  router.delete('/api/bank/connection', async ({ req, res, session }) => {
    await service.disconnect(session, clientIp(req));
    sendNoContent(res);
  });
}

/** `{ language }`, optional: anything but Georgian means English. */
export function parseConnectRequest(body: string): BankConnectRequest {
  if (!body.trim()) return { language: 'en' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
  const language = typeof parsed === 'object' && parsed !== null ? (parsed as Partial<BankConnectRequest>).language : undefined;
  return { language: language === 'ka' ? 'ka' : 'en' };
}
