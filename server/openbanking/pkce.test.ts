import { describe, expect, it } from 'vitest';
import { codeChallengeFor, createPkcePair, randomUrlSafe, safeEqual } from './pkce.ts';

describe('PKCE', () => {
  it('derives the S256 challenge of RFC 7636 appendix B', () => {
    expect(codeChallengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('creates a verifier of allowed characters and length, with its matching challenge', () => {
    const pair = createPkcePair();

    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(pair.challenge).toBe(codeChallengeFor(pair.verifier));
  });

  it('creates a different pair every time', () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});

describe('randomUrlSafe', () => {
  it('returns URL-safe text of the requested entropy', () => {
    expect(randomUrlSafe()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomUrlSafe(16)).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('does not repeat', () => {
    const values = new Set(Array.from({ length: 50 }, () => randomUrlSafe()));
    expect(values.size).toBe(50);
  });
});

describe('safeEqual', () => {
  it('compares strings', () => {
    expect(safeEqual('state-1', 'state-1')).toBe(true);
    expect(safeEqual('state-1', 'state-2')).toBe(false);
  });

  it('treats different lengths as different', () => {
    expect(safeEqual('state', 'state-longer')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});
