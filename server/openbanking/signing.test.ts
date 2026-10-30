import { constants, generateKeyPairSync, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SigningCredentials } from './signing.ts';
import { algorithmFor, computeDigest, parseCertificateChain, signRequest, withRequestSigning } from './signing.ts';
import type { HttpTransport, TransportRequest } from './transport.ts';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const rsaPss = generateKeyPairSync('rsa-pss', { modulusLength: 2048 });
const credentials: SigningCredentials = { privateKey: rsa.privateKey, certificateChain: ['U0lHTkVS', 'SU5URVJNRURJQVRF'] };
const signedAt = new Date('2026-10-29T09:15:30.123Z');

const consentRequest: TransportRequest = {
  method: 'POST',
  url: 'https://test-openbanking.tbcbank.ge/0.8/v1/consents?lang=ka',
  headers: {
    Accept: 'application/json',
    'X-Request-ID': '99391c7e-ad88-49ec-a2ad-99ddcb1f7721',
    'PSU-IP-Address': '192.168.8.78',
    'TPP-Redirect-URI': 'https://algi.example/api/bank/callback',
    'Content-Type': 'application/json',
    'Content-Length': '16',
  },
  body: '{"access":{}}   ',
};

interface DecodedSignature {
  header: {
    b64: boolean;
    x5c: string[];
    crit: string[];
    sigT: string;
    sigD: { pars: string[]; mId: string };
    alg: string;
  };
  encodedHeader: string;
  signature: Buffer;
}

function decode(signatureHeader: string): DecodedSignature {
  const [encodedHeader, payload, signature] = signatureHeader.split('.');
  expect(payload).toBe('');
  return {
    header: JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as DecodedSignature['header'],
    encodedHeader,
    signature: Buffer.from(signature, 'base64url'),
  };
}

function signingInput(encodedHeader: string, lines: string[]): Buffer {
  return Buffer.from(`${encodedHeader}.${lines.join('\n')}`, 'utf8');
}

describe('computeDigest', () => {
  it('is the base64 SHA-256 of the body, prefixed with the algorithm', () => {
    expect(computeDigest('')).toBe('SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    expect(computeDigest('hello')).toBe('SHA-256=LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
  });
});

describe('signRequest', () => {
  const headers = signRequest(consentRequest, credentials, signedAt);
  const decoded = decode(headers['X-JWS-Signature']);

  it('adds the body digest', () => {
    expect(headers.Digest).toBe(computeDigest(consentRequest.body ?? ''));
  });

  it("writes the protected header of TBC's JWS profile", () => {
    expect(decoded.header).toEqual({
      b64: false,
      x5c: ['U0lHTkVS', 'SU5URVJNRURJQVRF'],
      crit: ['sigT', 'sigD', 'b64'],
      sigT: '2026-10-29T09:15:30Z',
      sigD: {
        pars: ['(request-target)', 'host', 'x-request-id', 'content-type', 'content-length', 'digest', 'psu-ip-address'],
        mId: 'http://uri.etsi.org/19182/HttpHeaders',
      },
      alg: 'RS256',
    });
  });

  it('signs the protected header and the signed header lines (detached, unencoded payload)', () => {
    const lines = [
      '(request-target): post /0.8/v1/consents?lang=ka',
      'host: test-openbanking.tbcbank.ge',
      'x-request-id: 99391c7e-ad88-49ec-a2ad-99ddcb1f7721',
      'content-type: application/json',
      'content-length: 16',
      `digest: ${headers.Digest}`,
      'psu-ip-address: 192.168.8.78',
    ];

    const valid = verify('sha256', signingInput(decoded.encodedHeader, lines), { key: rsa.publicKey, padding: constants.RSA_PKCS1_PADDING }, decoded.signature);

    expect(valid).toBe(true);
  });

  it('does not sign headers outside the profile', () => {
    expect(decoded.header.sigD.pars).not.toContain('tpp-redirect-uri');
    expect(decoded.header.sigD.pars).not.toContain('accept');
  });

  it('signs a GET without content headers, with the digest of the empty body', () => {
    const get: TransportRequest = {
      method: 'GET',
      url: 'https://test-openbanking.tbcbank.ge:8443/0.8/v1/accounts?withBalance=true',
      headers: { 'X-Request-ID': 'req-1', 'Consent-ID': 'consent-1', 'PSU-IP-Address': '10.0.0.1', 'PSU-Geo-Location': 'GEO:42.00;43.50' },
    };

    const signed = signRequest(get, credentials, signedAt);
    const { header, encodedHeader, signature } = decode(signed['X-JWS-Signature']);
    const lines = [
      '(request-target): get /0.8/v1/accounts?withBalance=true',
      'host: test-openbanking.tbcbank.ge:8443',
      'x-request-id: req-1',
      'digest: SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
      'psu-ip-address: 10.0.0.1',
      'psu-geo-location: GEO:42.00;43.50',
    ];

    expect(signed.Digest).toBe('SHA-256=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    expect(header.sigD.pars).toEqual(['(request-target)', 'host', 'x-request-id', 'digest', 'psu-ip-address', 'psu-geo-location']);
    expect(verify('sha256', signingInput(encodedHeader, lines), rsa.publicKey, signature)).toBe(true);
  });

  it('uses PS256 with an RSA-PSS key', () => {
    const pssCredentials: SigningCredentials = { privateKey: rsaPss.privateKey, certificateChain: ['U0lHTkVS'] };
    const { header, encodedHeader, signature } = decode(signRequest(consentRequest, pssCredentials, signedAt)['X-JWS-Signature']);
    const lines = header.sigD.pars.map((name) => signedLine(name, consentRequest));

    expect(header.alg).toBe('PS256');
    expect(
      verify('sha256', signingInput(encodedHeader, lines), { key: rsaPss.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, signature),
    ).toBe(true);
  });

  it('refuses to sign without an X-Request-ID', () => {
    expect(() => signRequest({ method: 'GET', url: 'https://tbc.example/x', headers: {} }, credentials, signedAt)).toThrow(/X-Request-ID/);
  });
});

describe('algorithmFor', () => {
  it('matches the key type', () => {
    expect(algorithmFor(rsa.privateKey)).toBe('RS256');
    expect(algorithmFor(rsaPss.privateKey)).toBe('PS256');
  });

  it('rejects other keys', () => {
    const ec: KeyObject = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    expect(() => algorithmFor(ec)).toThrow(/Unsupported/);
  });
});

describe('withRequestSigning', () => {
  it('adds Digest and X-JWS-Signature to every request', async () => {
    const sent: TransportRequest[] = [];
    const transport: HttpTransport = {
      send: async (request) => {
        sent.push(request);
        return { status: 200, headers: {}, body: '{}' };
      },
    };

    await withRequestSigning(transport, credentials, () => signedAt).send(consentRequest);

    expect(sent[0].headers.Digest).toBe(computeDigest(consentRequest.body ?? ''));
    expect(sent[0].headers['X-JWS-Signature']).toMatch(/^[\w-]+\.\.[\w-]+$/);
    expect(sent[0].headers['PSU-IP-Address']).toBe('192.168.8.78');
  });
});

describe('parseCertificateChain', () => {
  it('returns the base64 body of every PEM certificate, in order', () => {
    const pem = [
      '-----BEGIN CERTIFICATE-----',
      'U0lH',
      'TkVS',
      '-----END CERTIFICATE-----',
      '-----BEGIN CERTIFICATE-----',
      'SU5URVJNRURJQVRF',
      '-----END CERTIFICATE-----',
    ].join('\n');

    expect(parseCertificateChain(pem)).toEqual(['U0lHTkVS', 'SU5URVJNRURJQVRF']);
  });

  it('rejects a file without certificates', () => {
    expect(() => parseCertificateChain('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----')).toThrow(/no PEM certificate/);
  });
});

function signedLine(name: string, request: TransportRequest): string {
  const url = new URL(request.url);
  const header = Object.entries(request.headers).find(([key]) => key.toLowerCase() === name)?.[1];
  const values: Record<string, string | undefined> = {
    '(request-target)': `${request.method.toLowerCase()} ${url.pathname}${url.search}`,
    host: url.host,
    digest: computeDigest(request.body ?? ''),
  };
  return `${name}: ${values[name] ?? header}`;
}
