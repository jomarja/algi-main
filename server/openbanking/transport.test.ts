import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.ts';
import { flattenHeaders, loadClientTls, readConfiguredFile } from './transport.ts';

describe('flattenHeaders', () => {
  it('lower-cases names, joins repeated values and drops missing ones', () => {
    expect(flattenHeaders({ 'X-Request-ID': 'abc', 'set-cookie': ['a=1', 'b=2'], age: undefined })).toEqual({
      'x-request-id': 'abc',
      'set-cookie': 'a=1, b=2',
    });
  });
});

describe('client TLS files', () => {
  it('needs no files in mock mode', () => {
    const tls = loadClientTls(loadConfig({ TBC_MODE: 'mock' }).tbc);

    expect(tls).toEqual({ cert: undefined, key: undefined, passphrase: undefined, ca: undefined });
  });

  it('names the setting and path of a file it cannot read', () => {
    expect(() => readConfiguredFile('/nonexistent/qwac.pem', 'TBC_CERT_PATH')).toThrow(/^TBC_CERT_PATH: cannot read \/nonexistent\/qwac\.pem/);
  });

  it('reads nothing when the setting is empty', () => {
    expect(readConfiguredFile(null, 'TBC_CA_PATH')).toBeUndefined();
  });
});
