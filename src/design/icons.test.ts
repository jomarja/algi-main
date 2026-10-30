import { CATEGORY_META } from '../engine/categories.ts';
import { GOAL_ICON_META } from '../engine/savingsGoal.ts';
import { OBJECTIVE_META } from '../engine/settings.ts';
import { tabs } from '../layout/tabs.ts';
import { fallbackGlyph, glyphs, isSymbolName, symbolNames } from './icons.ts';
import type { Glyph } from './icons.ts';

/** Every `systemName:` / `systemImage:` / symbol string in the iOS app's Swift sources. */
const iosSymbols = [
  'airplane',
  'arrow.counterclockwise',
  'arrow.down',
  'arrow.down.left',
  'arrow.right',
  'arrow.triangle.2.circlepath',
  'arrow.up',
  'arrow.up.circle',
  'arrow.uturn.forward.circle',
  'bag.fill',
  'banknote',
  'banknote.fill',
  'bolt.fill',
  'book',
  'book.fill',
  'bubble.left.and.text.bubble.right',
  'building.columns',
  'calendar',
  'calendar.badge.clock',
  'car.fill',
  'cart.fill',
  'chart.bar.xaxis',
  'chart.line.uptrend.xyaxis',
  'chart.pie.fill',
  'checkmark',
  'checkmark.circle.fill',
  'checkmark.seal',
  'chevron.down',
  'chevron.left',
  'chevron.right',
  'chevron.up',
  'circle',
  'clock',
  'creditcard',
  'creditcard.fill',
  'cross.case.fill',
  'doc.badge.plus',
  'doc.questionmark',
  'doc.text',
  'doc.text.fill',
  'doc.text.viewfinder',
  'exclamationmark.circle.fill',
  'figure.walk',
  'flag.checkered',
  'flag.fill',
  'flame.fill',
  'flask',
  'fork.knife',
  'frying.pan',
  'function',
  'gift.fill',
  'hand.raised.fill',
  'house',
  'house.fill',
  'info.circle',
  'info.circle.fill',
  'laptopcomputer',
  'line.3.horizontal.decrease',
  'list.bullet',
  'location.fill',
  'lock.fill',
  'lock.shield.fill',
  'magnifyingglass',
  'map',
  'minus',
  'paperplane.fill',
  'plus',
  'plus.circle.fill',
  'point.3.connected.trianglepath.dotted',
  'questionmark.circle',
  'repeat',
  'shield.lefthalf.filled',
  'slider.horizontal.3',
  'sparkle',
  'sparkles',
  'square.split.2x1',
  'star.fill',
  'tag',
  'takeoutbag.and.cup.and.straw.fill',
  'target',
  'tram.fill',
  'trophy.fill',
  'xmark.circle.fill',
  'xmark.octagon.fill',
];

describe('glyphs', () => {
  it('draw every SF Symbol the iOS app uses', () => {
    expect(iosSymbols.filter((name) => !isSymbolName(name))).toEqual([]);
  });

  it('draw every symbol the model layer and the tabs name', () => {
    const modelSymbols = [
      ...Object.values(CATEGORY_META).map((meta) => meta.icon),
      ...Object.values(OBJECTIVE_META).map((meta) => meta.icon),
      ...Object.values(GOAL_ICON_META).map((meta) => meta.symbol),
      ...tabs.map((tab) => tab.icon),
    ];
    expect(modelSymbols.filter((name) => !isSymbolName(name))).toEqual([]);
  });

  it('give each symbol at least one shape', () => {
    for (const name of symbolNames) {
      const glyph: Glyph = glyphs[name];
      const shapes = [glyph.fill, glyph.stroke, glyph.cut, glyph.dotted].flatMap((paths) => paths ?? []);
      expect(shapes.length, name).toBeGreaterThan(0);
    }
  });

  it('only cut into glyphs that have a fill', () => {
    for (const name of symbolNames) {
      const glyph: Glyph = glyphs[name];
      if (glyph.cut) expect(glyph.fill?.length, name).toBeGreaterThan(0);
    }
  });
});

describe('isSymbolName', () => {
  it('rejects unknown names and inherited keys', () => {
    expect(isSymbolName('not.a.symbol')).toBe(false);
    expect(isSymbolName('toString')).toBe(false);
  });

  it('has a visible fallback', () => {
    expect(fallbackGlyph.stroke?.length).toBeGreaterThan(0);
  });
});
