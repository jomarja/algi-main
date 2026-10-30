import { trendWavePath } from './trendWave.ts';

describe('trendWavePath', () => {
  it('draws nothing for fewer than two values', () => {
    expect(trendWavePath([], 100, 40)).toBe('');
    expect(trendWavePath([5], 100, 40)).toBe('');
  });

  it('spans the width and puts the lowest value at the bottom and the highest at the top', () => {
    expect(trendWavePath([10, 20], 100, 40)).toBe('M0 40C50 40 50 0 100 0');
  });

  it('eases each segment through control points at the midpoint', () => {
    expect(trendWavePath([0, 2, 1], 200, 20)).toBe('M0 20C50 20 50 0 100 0C150 0 150 10 200 10');
  });

  it('keeps a flat line from dividing by zero', () => {
    expect(trendWavePath([3, 3, 3], 100, 10)).toBe('M0 10C25 10 25 10 50 10C75 10 75 10 100 10');
  });
});
