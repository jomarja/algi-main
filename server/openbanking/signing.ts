import { constants, createHash, createPrivateKey, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import type { TbcConfig } from '../config.ts';
import type { HttpTransport, TransportRequest } from './transport.ts';
import { readConfiguredFile } from './transport.ts';

/**
 * Request signing for TBC Open Banking: a `Digest` of the body and a detached `X-JWS-Signature`.
 *
 * TBC's AIS overview says every call must carry X-JWS-Signature covering the body and the headers host,
 * X-Request-ID, digest, content-type and content-length (when present) and every psu-* header. This module
 * follows TBC's reference implementation (github.com/TBCBank/TBC.OpenBanking.Jws) of the Georgian Banking
 * Association's JWS profile (ETSI TS 119 182-1, HTTP headers as the signed data):
 *   - protected header {b64: false, x5c, crit: [sigT, sigD, b64], sigT, sigD: {pars, mId}, alg}
 *   - pars: (request-target), host, x-request-id, [content-type], [content-length], digest, psu-*
 *   - signing input: base64url(protected header) + "." + the "name: value" lines of `pars`, joined by "\n"
 *   - header value: base64url(protected header) + ".." + base64url(signature)
 * TBC must confirm this profile when Algi is onboarded (algorithm, which certificates go into x5c, the
 * header set); it is isolated here so any change stays in this file.
 */

export type JwsAlgorithm = 'RS256' | 'PS256';

export interface SigningCredentials {
  privateKey: KeyObject;
  /** Base64 DER certificates for `x5c`: the signing (QSealC) certificate first, then its intermediates. */
  certificateChain: string[];
}

const signedHeadersMechanism = 'http://uri.etsi.org/19182/HttpHeaders';
const headersSignedWhenPresent = ['content-type', 'content-length'];

export function computeDigest(body: string): string {
  return `SHA-256=${createHash('sha256').update(body, 'utf8').digest('base64')}`;
}

/** RS256 for an RSA key, PS256 for an RSA-PSS key. */
export function algorithmFor(key: KeyObject): JwsAlgorithm {
  if (key.asymmetricKeyType === 'rsa') return 'RS256';
  if (key.asymmetricKeyType === 'rsa-pss') return 'PS256';
  throw new Error(`Unsupported request-signing key type "${key.asymmetricKeyType}": use an RSA (RS256) or RSA-PSS (PS256) key`);
}

/** The `Digest` and `X-JWS-Signature` headers for `request`. */
export function signRequest(request: TransportRequest, credentials: SigningCredentials, now: Date): Record<string, string> {
  const digest = computeDigest(request.body ?? '');
  const signedHeaders = signedHeaderValues(request, digest);
  const algorithm = algorithmFor(credentials.privateKey);
  const protectedHeader = {
    b64: false,
    x5c: credentials.certificateChain,
    crit: ['sigT', 'sigD', 'b64'],
    sigT: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    sigD: { pars: [...signedHeaders.keys()], mId: signedHeadersMechanism },
    alg: algorithm,
  };
  const encodedHeader = Buffer.from(JSON.stringify(protectedHeader), 'utf8').toString('base64url');
  const payload = [...signedHeaders].map(([name, value]) => `${name}: ${value}`).join('\n');
  const signature = signBytes(Buffer.from(`${encodedHeader}.${payload}`, 'utf8'), credentials.privateKey, algorithm);
  return { Digest: digest, 'X-JWS-Signature': `${encodedHeader}..${signature.toString('base64url')}` };
}

/** Lower-case header names to their values, in the order the profile signs them. */
function signedHeaderValues(request: TransportRequest, digest: string): Map<string, string> {
  const url = new URL(request.url);
  const headers = new Map(Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), value.trim()]));
  const requestId = headers.get('x-request-id');
  if (!requestId) throw new Error('A signed TBC request needs an X-Request-ID header');

  const signed = new Map<string, string>([
    ['(request-target)', `${request.method.toLowerCase()} ${url.pathname}${url.search}`],
    ['host', headers.get('host') ?? url.host],
    ['x-request-id', requestId],
  ]);
  for (const name of headersSignedWhenPresent) {
    const value = headers.get(name);
    if (value !== undefined) signed.set(name, value);
  }
  signed.set('digest', digest);
  for (const [name, value] of headers) {
    if (name.startsWith('psu-')) signed.set(name, value);
  }
  return signed;
}

function signBytes(data: Buffer, key: KeyObject, algorithm: JwsAlgorithm): Buffer {
  return algorithm === 'PS256'
    ? sign('sha256', data, { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST })
    : sign('sha256', data, { key, padding: constants.RSA_PKCS1_PADDING });
}

/** Adds the signing headers to every request sent through `transport`. */
export function withRequestSigning(transport: HttpTransport, credentials: SigningCredentials, now: () => Date = () => new Date()): HttpTransport {
  return {
    send: (request) => transport.send({ ...request, headers: { ...request.headers, ...signRequest(request, credentials, now()) } }),
  };
}

/** The QSealC key and certificate named in the config, or null when request signing isn't configured. */
export function loadSigningCredentials(tbc: TbcConfig): SigningCredentials | null {
  const key = readConfiguredFile(tbc.signingKeyPath, 'TBC_SIGNING_KEY_PATH');
  const certificates = readConfiguredFile(tbc.signingCertPath, 'TBC_SIGNING_CERT_PATH');
  if (!key || !certificates) return null;
  // The QWAC passphrase is reused: the config has a single key passphrase.
  const privateKey = createPrivateKey({ key, passphrase: tbc.keyPassphrase ?? undefined });
  algorithmFor(privateKey); // rejects an unsupported key at start-up rather than on the first request
  return { privateKey, certificateChain: parseCertificateChain(certificates.toString('utf8')) };
}

/** The base64 DER bodies of the PEM certificates in `pem`, in file order. */
export function parseCertificateChain(pem: string): string[] {
  const bodies = [...pem.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/g)].map((match) =>
    match[1].replace(/\s+/g, ''),
  );
  if (bodies.length === 0) throw new Error('TBC_SIGNING_CERT_PATH contains no PEM certificate');
  return bodies;
}
