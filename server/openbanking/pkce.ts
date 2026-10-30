import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** RFC 7636 PKCE (S256) and the unguessable `state` and `nonce` values of the authorize request. */

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkcePair(): PkcePair {
  const verifier = randomUrlSafe();
  return { verifier, challenge: codeChallengeFor(verifier) };
}

export function codeChallengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/** Base64url of `bytes` random bytes. The default 32 bytes give 43 characters, PKCE's minimum verifier length. */
export function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time string comparison, so a forged `state` can't be found by timing. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
