import type { BankConnectRequest } from '../../shared/bank.ts';
import type { TbcConfig } from '../config.ts';
import type { TbcTokenGrant } from './tbc-types.ts';

/** TBC's OAuth SCA approach: the authorize URL the PSU opens, and the tokens the server keeps afterwards. */

export type BankLanguage = BankConnectRequest['language'];

export interface AuthorizeRequest {
  consentId: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  language: BankLanguage;
}

export function buildAuthorizeUrl(
  tbc: Pick<TbcConfig, 'authBaseUrl' | 'clientId' | 'redirectUri'>,
  request: AuthorizeRequest,
): string {
  const url = new URL(`${tbc.authBaseUrl}/psd2/openbanking/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: tbc.clientId,
    scope: `AIS:${request.consentId}`,
    response_type: 'code',
    redirect_uri: tbc.redirectUri,
    nonce: request.nonce,
    state: request.state,
    code_challenge: request.codeChallenge,
    code_challenge_method: 'S256',
    ui_locales: request.language,
  }).toString();
  return url.toString();
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  accessTokenExpiresAt: number;
  /** Epoch milliseconds, or null when TBC didn't say. */
  refreshTokenExpiresAt: number | null;
}

/** Used when TBC omits `expires_in`; its examples issue access tokens for 3599 seconds. */
const defaultAccessTokenSeconds = 3599;
/** Renew this long before the stated expiry, to absorb clock skew and request time. */
const expirySkewMs = 60_000;

/** Tokens from a token response. A refresh response without a new refresh token keeps the previous one. */
export function tokenSetFrom(grant: TbcTokenGrant, nowMs: number, previous?: TokenSet): TokenSet {
  const accessSeconds = positiveSeconds(grant.expires_in) ?? defaultAccessTokenSeconds;
  const refreshSeconds = positiveSeconds(grant.refresh_token_expires_in);
  const refreshTokenIsNew = Boolean(grant.refresh_token);
  return {
    accessToken: grant.access_token,
    refreshToken: grant.refresh_token || previous?.refreshToken || null,
    accessTokenExpiresAt: nowMs + accessSeconds * 1000,
    refreshTokenExpiresAt:
      refreshSeconds !== null ? nowMs + refreshSeconds * 1000 : refreshTokenIsNew ? null : (previous?.refreshTokenExpiresAt ?? null),
  };
}

export function isAccessTokenExpired(tokens: TokenSet, nowMs: number): boolean {
  return nowMs >= tokens.accessTokenExpiresAt - expirySkewMs;
}

/** The refresh token, while it can still be used. */
export function usableRefreshToken(tokens: TokenSet, nowMs: number): string | null {
  const expired = tokens.refreshTokenExpiresAt !== null && nowMs >= tokens.refreshTokenExpiresAt - expirySkewMs;
  return expired ? null : tokens.refreshToken;
}

function positiveSeconds(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
