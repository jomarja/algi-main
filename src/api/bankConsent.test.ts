import { parseBankConsentReturn } from './bankConsent.ts';

describe('parseBankConsentReturn', () => {
  it('ignores URLs without a bank outcome', () => {
    expect(parseBankConsentReturn('https://algi.test/plan?tab=1', null)).toBeNull();
    expect(parseBankConsentReturn('https://algi.test/?bank=maybe', null)).toBeNull();
  });

  it('reads a successful connection and returns to the remembered screen', () => {
    expect(parseBankConsentReturn('https://algi.test/?bank=connected', '/settings')).toEqual({
      result: { outcome: 'connected', reason: null },
      returnPath: '/settings',
    });
  });

  it('reads a failure with its reason', () => {
    expect(parseBankConsentReturn('https://algi.test/?bank=error&reason=access_denied', '/onboarding/bank')).toEqual({
      result: { outcome: 'error', reason: 'access_denied' },
      returnPath: '/onboarding/bank',
    });
  });

  it('strips only the bank parameters when nothing was remembered', () => {
    expect(parseBankConsentReturn('https://algi.test/plan?bank=error&reason=state_mismatch&keep=1#top', null)?.returnPath).toBe(
      '/plan?keep=1#top',
    );
  });

  it('refuses a remembered path that would leave the app', () => {
    expect(parseBankConsentReturn('https://algi.test/?bank=connected', '//evil.test')?.returnPath).toBe('/');
    expect(parseBankConsentReturn('https://algi.test/?bank=connected', 'https://evil.test')?.returnPath).toBe('/');
  });
});
