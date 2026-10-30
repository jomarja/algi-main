import { peekReveal, peekVisibleHeight, rubberBand } from './peek.ts';

describe('peekReveal', () => {
  it('rises with the pull until Luka is fully up', () => {
    expect(peekReveal(0, false)).toBe(0);
    expect(peekReveal(peekVisibleHeight / 2, false)).toBe(0.5);
    expect(peekReveal(peekVisibleHeight * 2, false)).toBe(1);
  });

  it('ignores a negative pull', () => {
    expect(peekReveal(-20, false)).toBe(0);
  });

  it('keeps Luka up while refreshing', () => {
    expect(peekReveal(0, true)).toBe(1);
  });
});

describe('rubberBand', () => {
  it('does not move for no pull or a push up', () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(-30)).toBe(0);
  });

  it('follows the finger with growing resistance', () => {
    expect(rubberBand(50)).toBeLessThan(50);
    expect(rubberBand(200) - rubberBand(150)).toBeLessThan(rubberBand(100) - rubberBand(50));
  });

  it('never passes 140px', () => {
    expect(rubberBand(10_000)).toBeLessThanOrEqual(140);
  });

  it('reaches the refresh threshold within a comfortable drag', () => {
    expect(rubberBand(160)).toBeGreaterThanOrEqual(peekVisibleHeight);
  });
});
