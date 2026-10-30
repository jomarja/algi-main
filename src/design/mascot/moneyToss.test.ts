import {
  arcPoint,
  flightKeyframes,
  handAnchor,
  landingPoint,
  lobHeights,
  throwingHand,
  tileCrop,
  tossArtFrame,
  tossPieces,
  tossTiming,
} from './moneyToss.ts';

describe('tossTiming', () => {
  it('lands the last piece after the launch delay, the stagger and one flight', () => {
    expect(tossTiming.landing).toBeCloseTo(0.55 + 0.08 * 5 + 0.65);
  });

  it('stays on screen 1.1 s after landing', () => {
    expect(tossTiming.total).toBeCloseTo(tossTiming.landing + 1.1);
  });

  it('fills the rest of the toss with Luka holding his pose', () => {
    const { sink, pop, hold, duck, comeBack, total } = tossTiming;
    expect(sink + pop + hold + duck + comeBack).toBeCloseTo(total);
    expect(hold).toBeGreaterThan(0);
  });

  it('has a lob height for every piece', () => {
    expect(lobHeights.length).toBeGreaterThanOrEqual(tossPieces.length);
  });
});

describe('tossArtFrame', () => {
  it('scales the artwork so the crop fills a square tile', () => {
    const frame = tossArtFrame({ width: 68, height: 68 });
    const side = 68 / tileCrop.width;
    expect(frame.width).toBeCloseTo(side);
    expect(frame.height).toBeCloseTo(side);
    expect(frame.x).toBeCloseTo(-tileCrop.x * side);
    expect(frame.y).toBeCloseTo(-tileCrop.y * side);
  });

  it('covers a tile of any shape', () => {
    const frame = tossArtFrame({ width: 100, height: 50 });
    expect(frame.width * tileCrop.width).toBeCloseTo(100);
    expect(frame.height * tileCrop.height).toBeGreaterThanOrEqual(50);
  });
});

describe('throwingHand', () => {
  it('places the hand at its anchor in the artwork, in the tile’s coordinates', () => {
    const tile = { x: 300, y: 120, width: 68, height: 68 };
    const art = tossArtFrame(tile);
    expect(throwingHand(tile)).toEqual({
      x: tile.x + art.x + handAnchor.x * art.width,
      y: tile.y + art.y + handAnchor.y * art.height,
    });
  });
});

describe('arcPoint', () => {
  const start = { x: 0, y: 100 };
  const end = { x: 200, y: 50 };

  it('starts at the hand and ends at the target', () => {
    expect(arcPoint(start, end, 0)).toEqual(start);
    expect(arcPoint(start, end, 1)).toEqual(end);
  });

  it('rises above both ends in between', () => {
    expect(arcPoint(start, end, 0.5, 90).y).toBeLessThan(end.y);
  });

  it('peaks higher with a bigger lob', () => {
    expect(arcPoint(start, end, 0.5, 120).y).toBeLessThan(arcPoint(start, end, 0.5, 60).y);
  });
});

describe('landingPoint', () => {
  const target = { x: 100, y: 40, width: 200, height: 40 };

  it('spreads the pieces across 60% of the target, centred', () => {
    expect(landingPoint(target, 0, 6)).toEqual({ x: 140, y: 60 });
    expect(landingPoint(target, 5, 6)).toEqual({ x: 260, y: 60 });
  });

  it('lands a single piece in the middle-left of the spread', () => {
    expect(landingPoint(target, 0, 1)).toEqual({ x: 140, y: 60 });
  });
});

describe('flightKeyframes', () => {
  const start = { x: 10, y: 200 };
  const end = { x: 300, y: 80 };

  it('samples the whole flight with evenly spaced offsets', () => {
    const frames = flightKeyframes('coin', start, end, 90, 24);
    expect(frames).toHaveLength(25);
    expect(frames[0].offset).toBe(0);
    expect(frames[24].offset).toBe(1);
  });

  it('is hidden before leaving the hand and on landing', () => {
    const frames = flightKeyframes('coin', start, end, 90, 24);
    expect(frames[0].opacity).toBe(0);
    expect(frames[12].opacity).toBe(1);
    expect(frames[24].opacity).toBe(0);
  });

  it('moves along the arc', () => {
    const frames = flightKeyframes('coin', start, end, 90, 4);
    const middle = arcPoint(start, end, 0.5, 90);
    expect(frames[2].transform).toContain(`translate(${middle.x}px, ${middle.y}px)`);
  });

  it('flips coins and flutters notes, keeping the same transform functions in every frame', () => {
    const coin = flightKeyframes('coin', start, end, 90, 4).map((frame) => String(frame.transform));
    const note = flightKeyframes('banknote', start, end, 90, 4).map((frame) => String(frame.transform));
    expect(coin.every((transform) => transform.includes('rotateY('))).toBe(true);
    expect(note.every((transform) => transform.includes('rotateX('))).toBe(true);
    expect(coin[4]).toContain('rotateY(720deg)');
  });
});
