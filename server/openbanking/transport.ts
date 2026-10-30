import { readFileSync } from 'node:fs';
import type { ClientRequest, IncomingHttpHeaders } from 'node:http';
import { request as httpRequest } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import type { TbcConfig } from '../config.ts';

export type TransportMethod = 'GET' | 'POST' | 'DELETE';

export interface TransportRequest {
  method: TransportMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface TransportResponse {
  status: number;
  /** Lower-case header names. */
  headers: Record<string, string>;
  body: string;
}

/** Sends one HTTP request. The seam that lets the TBC client and the signing step be tested without a network. */
export interface HttpTransport {
  send(request: TransportRequest): Promise<TransportResponse>;
}

/** QWAC client certificate and key (PEM) for mutual TLS, plus an optional extra CA bundle. */
export interface ClientTlsOptions {
  cert?: Buffer;
  key?: Buffer;
  passphrase?: string;
  ca?: Buffer;
}

const requestTimeoutMs = 20_000;
const maxResponseBytes = 10 * 1024 * 1024;

/**
 * node:http(s) transport. HTTPS calls present the QWAC certificate (mutual TLS): TBC authenticates the client
 * at the token endpoint by certificate (`tls_client_auth`) and binds access tokens to it, so every live call
 * must carry the same certificate. Plain HTTP is only used for the loopback mock bank.
 */
export function createNodeTransport(tls: ClientTlsOptions): HttpTransport {
  const httpsAgent = new HttpsAgent({ keepAlive: true, ...tls });
  return {
    send(request) {
      const url = new URL(request.url);
      const options = { method: request.method, headers: request.headers, timeout: requestTimeoutMs };
      const outgoing = url.protocol === 'https:' ? httpsRequest(url, { ...options, agent: httpsAgent }) : httpRequest(url, options);
      return exchange(outgoing, request.body);
    },
  };
}

function exchange(outgoing: ClientRequest, body: string | undefined): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    outgoing.on('timeout', () => outgoing.destroy(new Error(`no response within ${requestTimeoutMs / 1000} s`)));
    outgoing.on('error', reject);
    outgoing.on('response', (incoming) => {
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxResponseBytes) incoming.destroy(new Error('response too large'));
        else chunks.push(chunk);
      });
      incoming.on('error', reject);
      incoming.on('end', () =>
        resolve({
          status: incoming.statusCode ?? 0,
          headers: flattenHeaders(incoming.headers),
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
    outgoing.end(body);
  });
}

export function flattenHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) flat[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return flat;
}

/** Reads the mutual TLS files named in the config. Fails at start-up, with the path, when one can't be read. */
export function loadClientTls(tbc: TbcConfig): ClientTlsOptions {
  return {
    cert: readConfiguredFile(tbc.certPath, 'TBC_CERT_PATH'),
    key: readConfiguredFile(tbc.keyPath, 'TBC_KEY_PATH'),
    passphrase: tbc.keyPassphrase ?? undefined,
    ca: readConfiguredFile(tbc.caPath, 'TBC_CA_PATH'),
  };
}

export function readConfiguredFile(path: string | null, setting: string): Buffer | undefined {
  if (!path) return undefined;
  try {
    return readFileSync(path);
  } catch (error) {
    throw new Error(`${setting}: cannot read ${path} (${error instanceof Error ? error.message : String(error)})`);
  }
}
