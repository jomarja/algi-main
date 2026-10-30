import { cx } from './cx.ts';

describe('cx', () => {
  it('joins class names and skips falsy ones', () => {
    expect(cx('a', false, 'b', null, undefined, '', 'c')).toBe('a b c');
  });

  it('returns an empty string for no classes', () => {
    expect(cx(false, null)).toBe('');
  });
});
