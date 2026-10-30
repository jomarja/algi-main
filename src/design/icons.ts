/**
 * Inline SVG stand-ins for the SF Symbols the iOS app uses, drawn on a 24×24 grid.
 * `fill` shapes use the even-odd rule (inner subpaths become holes), `stroke` paths are 2-unit round lines,
 * `cut` paths are lines knocked out of the fill (e.g. the tick in checkmark.circle.fill), and `dotted` paths
 * render as dotted lines.
 */
export interface Glyph {
  fill?: readonly string[];
  stroke?: readonly string[];
  cut?: readonly string[];
  dotted?: readonly string[];
}

/** A full circle as a path, so circles compose with other subpaths. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

const documentOutline = 'M6.5 2.5h7l5 5v12a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z';
const documentFold = 'M13.5 2.5v5h5';
const calendarBody = 'M5.5 5h13a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z';
const calendarRings = 'M8 3v4M16 3v4';
const shield = 'M12 2.8l7.5 2.8v5.9c0 4.7-3.2 8.2-7.5 9.7-4.3-1.5-7.5-5-7.5-9.7V5.6z';
const roundBadge = circle(12, 12, 10);
const ring = circle(12, 12, 9);
const flagCloth = 'M5 4c3-1.6 5.5-1 7.5 0s4.5 1.6 7 0v9c-2.5 1.6-5 1-7 0s-4.5-1.6-7 0z';
const leftBubble = 'M14 7.5V6a2.5 2.5 0 0 0-2.5-2.5h-6A2.5 2.5 0 0 0 3 6v4a2.5 2.5 0 0 0 2.5 2.5H6V15l3-2.5';
const rightBubble =
  'M12.5 9.5h6A2.5 2.5 0 0 1 21 12v4a2.5 2.5 0 0 1-2.5 2.5H18V21l-3-2.5h-2.5A2.5 2.5 0 0 1 10 16v-4a2.5 2.5 0 0 1 2.5-2.5z';
const foldedMap = 'M3.5 6.5L9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z';

export const glyphs = {
  airplane: {
    fill: ['M21 15.5v-1.8l-7.5-4.6V4a1.5 1.5 0 0 0-3 0v5.1L3 13.7v1.8l7.5-2.3V18l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-4.8z'],
  },
  'arrow.clockwise': { stroke: ['M20 12a8 8 0 1 1-2.34-5.66L20 8.6', 'M20 4.6v4h-4'] },
  'arrow.counterclockwise': { stroke: ['M4 12a8 8 0 1 0 2.34-5.66L4 8.6', 'M4 4.6v4h4'] },
  'arrow.down': { stroke: ['M12 4v16', 'M6 14l6 6 6-6'] },
  'arrow.down.left': { stroke: ['M18 6L6 18', 'M6 8v10h10'] },
  'arrow.right': { stroke: ['M4 12h16', 'M14 6l6 6-6 6'] },
  'arrow.triangle.2.circlepath': {
    stroke: ['M4.5 12a7.5 7.5 0 0 1 13-5.1', 'M19 3.5v4h-4', 'M19.5 12a7.5 7.5 0 0 1-13 5.1', 'M5 20.5v-4h4'],
  },
  'arrow.up': { stroke: ['M12 20V4', 'M6 10l6-6 6 6'] },
  'arrow.up.circle': { stroke: [ring, 'M12 16.5v-9', 'M8 11l4-4 4 4'] },
  'arrow.uturn.forward.circle': { stroke: [ring, 'M8.5 16.5V13a3 3 0 0 1 3-3H16', 'M13.5 7.5L16 10l-2.5 2.5'] },
  'bag.fill': {
    fill: ['M5.2 8h13.6l1 12.2A1.7 1.7 0 0 1 18.1 22H5.9a1.7 1.7 0 0 1-1.7-1.8z'],
    stroke: ['M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8'],
  },
  banknote: {
    stroke: [
      'M4.5 6.5h15A1.5 1.5 0 0 1 21 8v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16V8a1.5 1.5 0 0 1 1.5-1.5z',
      circle(12, 12, 2.5),
    ],
  },
  'banknote.fill': {
    fill: ['M4.5 5.5h15A2.5 2.5 0 0 1 22 8v8a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 16V8a2.5 2.5 0 0 1 2.5-2.5z'],
    cut: [circle(12, 12, 2.6), 'M5.5 9v.01M18.5 15v.01'],
  },
  'bolt.fill': { fill: ['M13.5 2L4.5 13.5H11L9.5 22l9-11.5H12z'] },
  book: {
    stroke: ['M12 6.5C10.3 5 7.5 4.5 3.5 4.5v14c4 0 6.8.5 8.5 2 1.7-1.5 4.5-2 8.5-2v-14c-4 0-6.8.5-8.5 2z', 'M12 6.5v14'],
  },
  'book.fill': {
    fill: [
      'M11 6.2C9.2 4.8 6.6 4.3 3 4.3a.5.5 0 0 0-.5.5v13.7c0 .3.2.5.5.5 3.6 0 6.2.5 8 1.8z',
      'M13 6.2c1.8-1.4 4.4-1.9 8-1.9a.5.5 0 0 1 .5.5v13.7a.5.5 0 0 1-.5.5c-3.6 0-6.2.5-8 1.8z',
    ],
  },
  'bubble.left.and.text.bubble.right': { stroke: [leftBubble, rightBubble, 'M13.5 13h4M13.5 15.5H16'] },
  'bubble.left.and.text.bubble.right.fill': {
    fill: [
      'M5.5 3h6A3 3 0 0 1 14.5 6v2H12.5A3.5 3.5 0 0 0 9 11.5v1.6L6.2 15.4A.7.7 0 0 1 5 14.9V13A3 3 0 0 1 2.5 10V6a3 3 0 0 1 3-3z',
      rightBubble,
    ],
    cut: ['M13.5 13h4M13.5 15.5H16'],
  },
  'building.columns': {
    stroke: ['M3.5 9h17L12 3.5z', 'M5.5 11.5v6M10 11.5v6M14 11.5v6M18.5 11.5v6', 'M3.5 20.5h17'],
  },
  calendar: { stroke: [calendarBody, 'M3.5 9.5h17', calendarRings] },
  'calendar.badge.clock': {
    stroke: [
      'M11 20.5H5.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v3.5',
      'M3.5 9.5h17',
      calendarRings,
      circle(17, 17, 4),
      'M17 15.2V17l1.2 1',
    ],
  },
  'car.fill': {
    fill: [
      'M5.6 6.6A2.5 2.5 0 0 1 8 5h8a2.5 2.5 0 0 1 2.4 1.6L20 11a2 2 0 0 1 1.5 1.9V17a1 1 0 0 1-1 1h-1v1.5a1.5 1.5 0 0 1-3 0V18h-9v1.5a1.5 1.5 0 0 1-3 0V18h-1a1 1 0 0 1-1-1v-4.1A2 2 0 0 1 4 11z' +
        'M7.3 7.3L6.4 10.5h11.2l-.9-3.2a.6.6 0 0 0-.6-.3H7.9a.6.6 0 0 0-.6.3z',
    ],
    cut: ['M6.5 14H8M16 14h1.5'],
  },
  'cart.fill': {
    fill: [
      'M2.5 3.5h2.2a1 1 0 0 1 1 .8L6.1 6H20a1 1 0 0 1 1 1.2l-1.3 6.6a2 2 0 0 1-2 1.7H8.4l.3 1.5h9.8a1 1 0 0 1 0 2H8a1 1 0 0 1-1-.8L4 5.5H2.5a1 1 0 0 1 0-2z',
      circle(9, 20.8, 1.4),
      circle(17, 20.8, 1.4),
    ],
  },
  'chart.bar.xaxis': {
    stroke: ['M3 20.5h18'],
    fill: ['M5 11h3v6.5H5z', 'M9.5 5h3v12.5h-3z', 'M14 8h3v9.5h-3z', 'M18.5 13h2.5v4.5h-2.5z'],
  },
  'chart.line.uptrend.xyaxis': { stroke: ['M3.5 3.5v17h17', 'M7 15.5l4-4.5 3 3 5.5-6.5'] },
  'chart.pie.fill': { fill: ['M11 3.1A9 9 0 1 0 20.9 13H11z', 'M13 2.1V11h8.9A9 9 0 0 0 13 2.1z'] },
  checkmark: { stroke: ['M4.5 12.5l5 5 10-11'] },
  'checkmark.circle.fill': { fill: [roundBadge], cut: ['M7.5 12.5l3 3 6-6.5'] },
  'checkmark.seal': {
    stroke: [
      'M12 2.5l2.4 1.7 2.9-.2 1 2.7 2.4 1.7-.8 2.8.8 2.8-2.4 1.7-1 2.7-2.9-.2-2.4 1.7-2.4-1.7-2.9.2-1-2.7-2.4-1.7.8-2.8-.8-2.8 2.4-1.7 1-2.7 2.9.2z',
      'M8.5 12l2.5 2.5 4.5-5',
    ],
  },
  'chevron.down': { stroke: ['M5 9l7 7 7-7'] },
  'chevron.left': { stroke: ['M15 5l-7 7 7 7'] },
  'chevron.right': { stroke: ['M9 5l7 7-7 7'] },
  'chevron.up': { stroke: ['M5 15l7-7 7 7'] },
  circle: { stroke: [ring] },
  clock: { stroke: [ring, 'M12 7v5l3.5 2'] },
  creditcard: {
    stroke: ['M5 5.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z', 'M3 10h18', 'M6.5 15h3'],
  },
  'creditcard.fill': {
    fill: ['M5 5h14a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 19 19H5a2.5 2.5 0 0 1-2.5-2.5v-9A2.5 2.5 0 0 1 5 5z'],
    cut: ['M2.5 9.5h19', 'M6 15h3'],
  },
  'cross.case.fill': {
    fill: ['M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z'],
    stroke: ['M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7'],
    cut: ['M12 10.5v7M8.5 14h7'],
  },
  'doc.badge.plus': {
    stroke: ['M12 21.5H6.5a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2h7l5 5v4', documentFold, 'M18 15v6M15 18h6'],
  },
  'doc.questionmark': {
    stroke: [documentOutline, documentFold, 'M10 11.5a2 2 0 1 1 2.8 1.8c-.5.2-.8.7-.8 1.2v.5', 'M12 18h.01'],
  },
  'doc.text': { stroke: [documentOutline, documentFold, 'M8.5 12.5h7M8.5 16h7'] },
  'doc.text.fill': {
    fill: ['M6.5 2h6.8a1 1 0 0 1 .7.3l5.7 5.7a1 1 0 0 1 .3.7V20a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z'],
    cut: ['M8.5 12.5h7M8.5 16h7', 'M13.5 2.5v5h5'],
  },
  'doc.text.viewfinder': {
    stroke: [
      'M3 7.5V5a2 2 0 0 1 2-2h2.5M16.5 3H19a2 2 0 0 1 2 2v2.5M21 16.5V19a2 2 0 0 1-2 2h-2.5M7.5 21H5a2 2 0 0 1-2-2v-2.5',
      'M9 6.5h4.5L16 9v7.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z',
      'M10 11.5h4M10 14.5h4',
    ],
  },
  'exclamationmark.circle.fill': { fill: [roundBadge], cut: ['M12 7v6', 'M12 16.8h.01'] },
  'figure.walk': {
    fill: [circle(13.5, 4, 2)],
    stroke: ['M10.5 21l2.5-6.5 2.5 2.5V21', 'M13 14.5l1-5.5-3.5 2-1.5 3.5', 'M14 9l1.5 3 3 1'],
  },
  'flag.checkered': {
    stroke: ['M5 21.5v-18', flagCloth],
    fill: ['M5 4h3.6v4.5H5z', 'M12.2 4.4h3.7v4.4h-3.7z', 'M8.6 8.5h3.6V13H8.6z', 'M15.9 8.6h3.6v4.2h-3.6z'],
  },
  'flag.fill': { stroke: ['M5 21.5v-18'], fill: [flagCloth] },
  'flame.fill': {
    fill: ['M12 22c-4.1 0-7-2.9-7-6.8 0-3.4 2.3-5.6 4-7.5.5 1.6 1.4 2.6 2.4 3C11.2 7.5 12.3 4.5 15 2c.2 3.8 4 6.5 4 12.4 0 4.3-3 7.6-7 7.6z'],
  },
  flask: {
    stroke: ['M9.5 3h5', 'M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3', 'M7.5 15h9'],
  },
  'fork.knife': { stroke: ['M6 3v5a3 3 0 0 0 6 0V3', 'M9 3v18', 'M18 21V3c-2.2 1.5-3.2 4-3.2 7.2V13H18'] },
  'frying.pan': { stroke: [circle(9, 13, 6.5), 'M14.5 10.5l7-6'] },
  function: {
    stroke: [
      'M14 3.5c-2.5 0-3.3 1.5-3.6 3.5L8.6 18.5C8.3 20.4 7.5 21 6 21',
      'M7.5 9.5h7',
      'M15 13l4.5 5M19.5 13L15 18',
    ],
  },
  'gift.fill': {
    fill: ['M3 8h18v4H3z', 'M4.5 13h15v7a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20z'],
    stroke: ['M12 8C10.5 4.5 7 4 7 6.2 7 8 12 8 12 8z', 'M12 8c1.5-3.5 5-4 5-1.8C17 8 12 8 12 8z'],
    cut: ['M12 8v13.5'],
  },
  'hand.raised.fill': {
    fill: [
      'M8 12V5a1.25 1.25 0 0 1 2.5 0v6h.5V3.5a1.25 1.25 0 0 1 2.5 0V11h.5V4.5a1.25 1.25 0 0 1 2.5 0V12h.5V7a1.25 1.25 0 0 1 2.5 0v7.5c0 4.1-2.9 7.5-7 7.5-2.6 0-4.3-1.3-5.6-3.4l-2.6-4.4a1.3 1.3 0 0 1 2.2-1.4L8 15.3z',
    ],
  },
  house: { stroke: ['M3.5 11L12 3.8l8.5 7.2', 'M5.5 9.5V20H10v-6h4v6h4.5V9.5'] },
  'house.fill': {
    fill: [
      'M12 3.2l9.2 7.8a1 1 0 0 1-1.3 1.5l-.9-.7V20a1 1 0 0 1-1 1h-4v-6h-4v6H6a1 1 0 0 1-1-1v-8.2l-.9.7a1 1 0 0 1-1.3-1.5z',
    ],
  },
  'info.circle': { stroke: [ring, 'M12 11v6', 'M12 7.6h.01'] },
  'info.circle.fill': { fill: [roundBadge], cut: ['M12 11v6', 'M12 7.6h.01'] },
  laptopcomputer: { stroke: ['M5 5.5h14a1 1 0 0 1 1 1V16H4V6.5a1 1 0 0 1 1-1z', 'M2 18.5h20'] },
  'line.3.horizontal.decrease': { stroke: ['M4 7h16', 'M7 12h10', 'M10 17h4'] },
  'list.bullet': {
    stroke: ['M9 6.5h11', 'M9 12h11', 'M9 17.5h11'],
    fill: [circle(4.5, 6.5, 1.4), circle(4.5, 12, 1.4), circle(4.5, 17.5, 1.4)],
  },
  'location.fill': { fill: ['M20.5 3.5L3.5 10.8l7.2 2.5 2.5 7.2z'] },
  'lock.fill': {
    fill: ['M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20v-8A1.5 1.5 0 0 1 6 10.5z'],
    stroke: ['M8 10.5v-3a4 4 0 0 1 8 0v3'],
  },
  'lock.shield.fill': {
    fill: ['M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z' + 'M9.3 11.5h5.4V16H9.3z'],
    cut: ['M10.3 11.5v-1.3a1.7 1.7 0 0 1 3.4 0v1.3'],
  },
  magnifyingglass: { stroke: [circle(10.5, 10.5, 6.5), 'M15.5 15.5l5 5'] },
  map: { stroke: [foldedMap, 'M9 4v13.5', 'M15 6.5V20'] },
  'map.fill': { fill: [foldedMap], cut: ['M9 4v13.5', 'M15 6.5V20'] },
  minus: { stroke: ['M5 12h14'] },
  'paperplane.fill': { fill: ['M21.5 2.5L2.5 10.2l7 3 3 7.3z'], cut: ['M21.5 2.5L9.5 13.2'] },
  plus: { stroke: ['M12 5v14', 'M5 12h14'] },
  'plus.circle.fill': { fill: [roundBadge], cut: ['M12 7.5v9', 'M7.5 12h9'] },
  'point.3.connected.trianglepath.dotted': {
    fill: [circle(12, 4.5, 2.2), circle(4.5, 18.5, 2.2), circle(19.5, 18.5, 2.2)],
    dotted: ['M10.8 7L5.7 16', 'M13.2 7l5.1 9', 'M7.5 18.5h9'],
  },
  'questionmark.circle': {
    stroke: [ring, 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7', 'M12 17h.01'],
  },
  repeat: {
    stroke: ['M17 2.5l3 3-3 3', 'M4 11.5v-1a5 5 0 0 1 5-5h11', 'M7 21.5l-3-3 3-3', 'M20 12.5v1a5 5 0 0 1-5 5H4'],
  },
  'shield.lefthalf.filled': { stroke: [shield], fill: ['M12 2.8v18.4c-4.3-1.5-7.5-5-7.5-9.7V5.6z'] },
  'slider.horizontal.3': {
    stroke: [
      'M3 6h11M18 6h3',
      circle(16, 6, 2),
      'M3 12h3M10 12h11',
      circle(8, 12, 2),
      'M3 18h9M16 18h5',
      circle(14, 18, 2),
    ],
  },
  sparkle: { fill: ['M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2z'] },
  sparkles: {
    fill: [
      'M10 5Q10.8 12.2 18 13Q10.8 13.8 10 21Q9.2 13.8 2 13Q9.2 12.2 10 5z',
      'M18 2Q18.4 5.6 22 6Q18.4 6.4 18 10Q17.6 6.4 14 6Q17.6 5.6 18 2z',
    ],
  },
  'square.split.2x1': {
    stroke: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M12 4v16'],
  },
  'star.fill': { fill: ['M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z'] },
  tag: {
    stroke: [
      'M3.5 4.5v6.3a1 1 0 0 0 .3.7l8.7 8.7a1.5 1.5 0 0 0 2.1 0l5.2-5.2a1.5 1.5 0 0 0 0-2.1L11.1 4.2a1 1 0 0 0-.7-.3H4.1a.6.6 0 0 0-.6.6z',
      'M7.8 8.2h.01',
    ],
  },
  'takeoutbag.and.cup.and.straw.fill': {
    fill: [
      'M2.6 9.5h10.3l-.9 10.8A1.8 1.8 0 0 1 10.2 22H5.3a1.8 1.8 0 0 1-1.8-1.7z',
      'M14 12h7.2l-.9 8.5a1.7 1.7 0 0 1-1.7 1.5h-2a1.7 1.7 0 0 1-1.7-1.5z',
      'M13.6 10.2h8V12h-8z',
    ],
    stroke: ['M5.3 9.5V7.6a2.45 2.45 0 0 1 4.9 0v1.9', 'M18.6 10.2l1-5.2 2.1-.6'],
  },
  target: { stroke: [ring, circle(12, 12, 5)], fill: [circle(12, 12, 1.5)] },
  'tram.fill': {
    fill: [
      'M7 3.5h10a2.5 2.5 0 0 1 2.5 2.5v9.5a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 7 3.5z' +
        'M7.5 7.5h9v4h-9z',
    ],
    stroke: ['M8.5 18.5l-2 3M15.5 18.5l2 3', 'M10 1.5h4'],
    cut: ['M8.5 14.5h.01M15.5 14.5h.01'],
  },
  'trophy.fill': {
    fill: [
      'M7 3h10v6a5 5 0 0 1-10 0z',
      'M11 13.5h2V18h-2z',
      'M7.5 18h9a1 1 0 0 1 1 1v2h-11v-2a1 1 0 0 1 1-1z',
    ],
    stroke: ['M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10', 'M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10'],
  },
  xmark: { stroke: ['M6 6l12 12', 'M18 6L6 18'] },
  'xmark.circle.fill': { fill: [roundBadge], cut: ['M8.5 8.5l7 7', 'M15.5 8.5l-7 7'] },
  'xmark.octagon.fill': {
    fill: ['M8.3 2.5h7.4l5.3 5.3v7.4l-5.3 5.3H8.3L3 15.2V7.8z'],
    cut: ['M9 9l6 6', 'M15 9l-6 6'],
  },
} as const satisfies Record<string, Glyph>;

export type SymbolName = keyof typeof glyphs;

export const symbolNames = Object.keys(glyphs) as SymbolName[];

export function isSymbolName(name: string): name is SymbolName {
  return Object.prototype.hasOwnProperty.call(glyphs, name);
}

/** Shown for a symbol the set doesn't include yet, so a missing glyph never breaks a screen. */
export const fallbackGlyph: Glyph = { stroke: [ring], fill: [circle(12, 12, 2)] };
