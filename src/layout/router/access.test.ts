import { accessRedirect } from './access.ts';

describe('accessRedirect', () => {
  it('sends app screens to the welcome screen until onboarding is complete', () => {
    expect(accessRedirect('app', false)).toBe('/welcome');
    expect(accessRedirect('app', true)).toBeNull();
  });

  it('sends onboarding screens home once onboarding is complete', () => {
    expect(accessRedirect('onboarding', true)).toBe('/');
    expect(accessRedirect('onboarding', false)).toBeNull();
  });

  it('never redirects screens open to everyone', () => {
    expect(accessRedirect('any', false)).toBeNull();
    expect(accessRedirect('any', true)).toBeNull();
  });
});
