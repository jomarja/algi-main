import { NON_BREAKING_SPACE } from '../../../engine/index.ts';
import { formatCount } from './messageLimit.ts';

describe('formatCount', () => {
  it('groups thousands with a comma in English', () => {
    expect(formatCount(4000, 'en')).toBe('4,000');
    expect(formatCount(1234567, 'en')).toBe('1,234,567');
  });

  it('groups thousands with a non-breaking space in Georgian, four-digit numbers included', () => {
    expect(formatCount(4000, 'ka')).toBe(`4${NON_BREAKING_SPACE}000`);
  });

  it('leaves small numbers alone', () => {
    expect(formatCount(999, 'en')).toBe('999');
    expect(formatCount(0, 'ka')).toBe('0');
  });
});
