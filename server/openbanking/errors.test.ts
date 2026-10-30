import { describe, expect, it } from 'vitest';
import {
  TbcApiError,
  TbcProtocolError,
  bankErrorToHttp,
  isAccessTokenRejected,
  isConsentRejected,
  isProductUnavailable,
} from './errors.ts';

const tokenExpired = new TbcApiError('listAccounts', 401, {
  type: 'https://developers.tbcbank.ge/docs/error-type-401',
  title: 'Access Token is expired.',
  status: 401,
  code: 'TOKEN_EXPIRED',
  traceId: 'rrt-04053ba3aa8013db2-a-de-14879-4916302-1',
});
const consentInvalid = new TbcApiError('listAccounts', 401, { code: 'CONSENT_INVALID', status: 401, detail: 'Consent does not have access on accounts balances' });
const consentUnknown = new TbcApiError('getConsentStatus', 403, { code: 'CONSENT_UNKNOWN', status: 403 });

describe('TbcApiError', () => {
  it('keeps the code and trace ID but not the detail', () => {
    expect(consentInvalid.code).toBe('CONSENT_INVALID');
    expect(consentInvalid.message).toBe('TBC listAccounts failed: 401 CONSENT_INVALID');
    expect(consentInvalid.message).not.toContain('balances');
    expect(tokenExpired.message).toContain('rrt-04053ba3aa8013db2-a-de-14879-4916302-1');
  });

  it("takes OAuth's error field as the code", () => {
    expect(new TbcApiError('exchangeAuthorizationCode', 400, { error: 'invalid_request' }).code).toBe('invalid_request');
  });

  it('falls back to the status when TBC sends no code', () => {
    expect(new TbcApiError('listAccounts', 500, { code: '', title: 'Internal Error' }).code).toBe('HTTP_500');
    expect(new TbcApiError('listAccounts', 503, null).code).toBe('HTTP_503');
  });
});

describe('error classification', () => {
  it('tells consent problems from token problems', () => {
    expect(isConsentRejected(consentInvalid)).toBe(true);
    expect(isConsentRejected(consentUnknown)).toBe(true);
    expect(isConsentRejected(tokenExpired)).toBe(false);

    expect(isAccessTokenRejected(tokenExpired)).toBe(true);
    expect(isAccessTokenRejected(new TbcApiError('listAccounts', 401, null))).toBe(true);
    expect(isAccessTokenRejected(consentInvalid)).toBe(false);
  });

  it('treats 401, 403 and 404 from a product as "not offered"', () => {
    expect(isProductUnavailable(new TbcApiError('listLoans', 401, null))).toBe(true);
    expect(isProductUnavailable(new TbcApiError('listLoans', 403, null))).toBe(true);
    expect(isProductUnavailable(new TbcApiError('listLoans', 404, null))).toBe(true);
    expect(isProductUnavailable(new TbcApiError('listLoans', 500, null))).toBe(false);
    expect(isProductUnavailable(new Error('other'))).toBe(false);
  });
});

describe('bankErrorToHttp', () => {
  it.each([
    [consentInvalid, 401, 'not_connected'],
    [consentUnknown, 401, 'not_connected'],
    [tokenExpired, 401, 'not_connected'],
    [new TbcApiError('listAccounts', 429, null), 503, 'bank_rate_limited'],
    [new TbcApiError('listAccounts', 500, null), 502, 'bank_unavailable'],
    [new TbcApiError('listAccounts', 400, { code: 'FORMAT_ERROR' }), 502, 'bank_request_rejected'],
    [new TbcProtocolError('listAccounts', 'the request failed: ETIMEDOUT'), 502, 'bank_unreachable'],
  ])('maps %s to %i %s', (error, status, code) => {
    const httpError = bankErrorToHttp(error);

    expect(httpError.status).toBe(status);
    expect(httpError.code).toBe(code);
  });

  it('gives the browser a message of its own, not TBC payloads', () => {
    expect(bankErrorToHttp(consentInvalid).message).not.toContain('Consent does not have access');
  });
});
