import { buildPath, joinPaths, matchPath, paramCount } from './matchPath.ts';

describe('joinPaths', () => {
  it('joins a parent and a child segment', () => {
    expect(joinPaths('/plan', 'what-if')).toBe('/plan/what-if');
  });

  it('keeps the root for an empty child', () => {
    expect(joinPaths('/', '')).toBe('/');
  });

  it('ignores stray slashes', () => {
    expect(joinPaths('/coach/', '/recommendations/')).toBe('/coach/recommendations');
  });
});

describe('matchPath', () => {
  it('matches a static path exactly', () => {
    expect(matchPath('/plan/what-if', '/plan/what-if')).toEqual({});
  });

  it('captures params', () => {
    expect(matchPath('/goals/:goalId', '/goals/car-fund')).toEqual({ goalId: 'car-fund' });
  });

  it('decodes captured params', () => {
    expect(matchPath('/goals/:goalId', '/goals/new%20car')).toEqual({ goalId: 'new car' });
  });

  it('keeps a param that is not valid percent-encoding as is', () => {
    expect(matchPath('/goals/:goalId', '/goals/100%')).toEqual({ goalId: '100%' });
  });

  it('treats a trailing slash like no slash', () => {
    expect(matchPath('/plan', '/plan/')).toEqual({});
  });

  it('matches the root only for the root', () => {
    expect(matchPath('/', '/')).toEqual({});
    expect(matchPath('/', '/plan')).toBeNull();
  });

  it('rejects paths of a different length', () => {
    expect(matchPath('/goals/:goalId', '/goals')).toBeNull();
    expect(matchPath('/goals/:goalId', '/goals/car/edit')).toBeNull();
  });

  it('rejects a different static segment', () => {
    expect(matchPath('/plan/what-if', '/plan/loans')).toBeNull();
  });
});

describe('buildPath', () => {
  it('fills and encodes params', () => {
    expect(buildPath('/goals/:goalId', { goalId: 'new car' })).toBe('/goals/new%20car');
  });

  it('returns static patterns unchanged', () => {
    expect(buildPath('/plan/budget')).toBe('/plan/budget');
  });

  it('throws when a param is missing', () => {
    expect(() => buildPath('/goals/:goalId', {})).toThrow('goalId');
  });
});

describe('paramCount', () => {
  it('counts dynamic segments', () => {
    expect(paramCount('/transactions/new')).toBe(0);
    expect(paramCount('/coach/recommendations/:recommendationId')).toBe(1);
  });
});
