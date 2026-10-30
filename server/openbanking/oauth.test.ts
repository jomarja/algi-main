import { describe, expect, it } from 'vitest';
import type { TokenSet } from './oauth.ts';
import { buildAuthorizeUrl, isAccessTokenExpired, tokenSetFrom, usableRefreshToken } from './oauth.ts';

const tbc = {
  authBaseUrl: 'https://test-api.tbcbank.ge',
  clientId: 'PSDGE-NBG-TESTGE11',
  redirectUri: 'https://algi.example/api/bank/callback',
};

describe('buildAuthorizeUrl', () => {
  const url = new URL(
    buildAuthorizeUrl(tbc, {
      consentId: 'c79ad1fb-8d01-44fc-b602-9ce471033952',
      state: 'state-value',
      nonce: 'nonce-value',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      language: 'ka',
    }),
  );

  it("points at TBC's authorize endpoint on the auth host", () => {
    expect(`${url.origin}${url.pathname}`).toBe('https://test-api.tbcbank.ge/psd2/openbanking/oauth/authorize');
  });

  it('carries the OAuth SCA parameters of the spec, scoped to the consent', () => {
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'PSDGE-NBG-TESTGE11',
      scope: 'AIS:c79ad1fb-8d01-44fc-b602-9ce471033952',
      response_type: 'code',
      redirect_uri: 'https://algi.example/api/bank/callback',
      nonce: 'nonce-value',
      state: 'state-value',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      ui_locales: 'ka',
    });
  });

  it('never carries the code verifier', () => {
    expect(url.toString()).not.toContain('code_verifier');
  });
});

describe('tokenSetFrom', () => {
  const now = 1_700_000_000_000;

  it("reads TBC's token example: expires_in as a number, refresh_token_expires_in as a string", () => {
    const tokens = tokenSetFrom(
      {
        access_token: 'ffODwEVU5sD9RADdEWEYUQNijrcE',
        token_type: 'Bearer',
        refresh_token: 'qjfHpGMyOZGv7gZVRxGPGoPfbgHNwIHs',
        refresh_token_issued_at: '1682595156807',
        refresh_token_expires_in: '7775999',
        refresh_count: 0,
        scope: 'AIS:45f90ecc-3879-4574-de8e-08db40b82e17',
        issued_at: '1682595156807',
        expires_in: 3599,
      },
      now,
    );

    expect(tokens).toEqual({
      accessToken: 'ffODwEVU5sD9RADdEWEYUQNijrcE',
      refreshToken: 'qjfHpGMyOZGv7gZVRxGPGoPfbgHNwIHs',
      accessTokenExpiresAt: now + 3_599_000,
      refreshTokenExpiresAt: now + 7_775_999_000,
    });
  });

  it('accepts expires_in as a string, as the schema documents it', () => {
    expect(tokenSetFrom({ access_token: 'a', expires_in: '600' }, now).accessTokenExpiresAt).toBe(now + 600_000);
  });

  it('assumes the documented hour when expires_in is missing or unusable', () => {
    expect(tokenSetFrom({ access_token: 'a' }, now).accessTokenExpiresAt).toBe(now + 3_599_000);
    expect(tokenSetFrom({ access_token: 'a', expires_in: 'soon' }, now).accessTokenExpiresAt).toBe(now + 3_599_000);
  });

  it('keeps the previous refresh token and its expiry when a refresh response has none', () => {
    const previous: TokenSet = { accessToken: 'old', refreshToken: 'refresh-1', accessTokenExpiresAt: now, refreshTokenExpiresAt: now + 1000 };

    const renewed = tokenSetFrom({ access_token: 'new', expires_in: 3599 }, now, previous);

    expect(renewed.refreshToken).toBe('refresh-1');
    expect(renewed.refreshTokenExpiresAt).toBe(now + 1000);
  });

  it('takes a rotated refresh token', () => {
    const previous: TokenSet = { accessToken: 'old', refreshToken: 'refresh-1', accessTokenExpiresAt: now, refreshTokenExpiresAt: now + 1000 };

    const renewed = tokenSetFrom({ access_token: 'new', refresh_token: 'refresh-2', refresh_token_expires_in: '60' }, now, previous);

    expect(renewed.refreshToken).toBe('refresh-2');
    expect(renewed.refreshTokenExpiresAt).toBe(now + 60_000);
  });

  it('has no refresh token when TBC issues none', () => {
    expect(tokenSetFrom({ access_token: 'a' }, now).refreshToken).toBeNull();
  });
});

describe('token expiry', () => {
  const tokens: TokenSet = { accessToken: 'a', refreshToken: 'r', accessTokenExpiresAt: 100_000, refreshTokenExpiresAt: 500_000 };

  it('treats the access token as expired a minute early', () => {
    expect(isAccessTokenExpired(tokens, 39_999)).toBe(false);
    expect(isAccessTokenExpired(tokens, 40_000)).toBe(true);
  });

  it('offers the refresh token until shortly before it expires', () => {
    expect(usableRefreshToken(tokens, 439_999)).toBe('r');
    expect(usableRefreshToken(tokens, 440_000)).toBeNull();
  });

  it('offers a refresh token without a known expiry', () => {
    expect(usableRefreshToken({ ...tokens, refreshTokenExpiresAt: null }, Number.MAX_SAFE_INTEGER)).toBe('r');
  });

  it('offers nothing when there is no refresh token', () => {
    expect(usableRefreshToken({ ...tokens, refreshToken: null }, 0)).toBeNull();
  });
});
