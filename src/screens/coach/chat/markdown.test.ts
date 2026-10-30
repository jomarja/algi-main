import { markdownToPlainText, parseInline, parseMarkdown } from './markdown.ts';

const plain = (text: string) => ({ text, isBold: false });
const bold = (text: string) => ({ text, isBold: true });

describe('parseInline', () => {
  it('reads plain text as one span', () => {
    expect(parseInline('You have 323 ₾ left.')).toEqual([plain('You have 323 ₾ left.')]);
  });

  it('marks bold spans', () => {
    expect(parseInline('You have **323 ₾** left.')).toEqual([plain('You have '), bold('323 ₾'), plain(' left.')]);
  });

  it('reads several bold spans on a line', () => {
    expect(parseInline('**A** and **B**')).toEqual([bold('A'), plain(' and '), bold('B')]);
  });

  it('drops a marker without its partner, as half-way through a stream', () => {
    expect(parseInline('You have **323')).toEqual([plain('You have 323')]);
  });

  it('gives the same result on every call', () => {
    expect(parseInline('**A** b')).toEqual(parseInline('**A** b'));
  });

  it('keeps markup-like text as text', () => {
    expect(parseInline('<img src=x onerror=alert(1)> & co')).toEqual([plain('<img src=x onerror=alert(1)> & co')]);
  });

  it('gives nothing for an empty line', () => {
    expect(parseInline('')).toEqual([]);
  });
});

describe('parseMarkdown', () => {
  it('keeps line breaks inside a paragraph', () => {
    expect(parseMarkdown('First line\nSecond line')).toEqual([{ kind: 'paragraph', lines: [[plain('First line')], [plain('Second line')]] }]);
  });

  it('splits paragraphs at blank lines', () => {
    expect(parseMarkdown('One.\n\n\nTwo.')).toEqual([
      { kind: 'paragraph', lines: [[plain('One.')]] },
      { kind: 'paragraph', lines: [[plain('Two.')]] },
    ]);
  });

  it('groups bullet lines into a list, whichever marker they use', () => {
    expect(parseMarkdown('Two ideas:\n- Cook at home\n* **Skip** one delivery\n• Walk')).toEqual([
      { kind: 'paragraph', lines: [[plain('Two ideas:')]] },
      { kind: 'bullets', items: [[plain('Cook at home')], [bold('Skip'), plain(' one delivery')], [plain('Walk')]] },
    ]);
  });

  it('reads numbered lists from their first number', () => {
    expect(parseMarkdown('3. Third\n4) Fourth')).toEqual([{ kind: 'numbered', start: 3, items: [[plain('Third')], [plain('Fourth')]] }]);
  });

  it('starts a new list when the marker type changes', () => {
    expect(parseMarkdown('- A\n1. B')).toEqual([
      { kind: 'bullets', items: [[plain('A')]] },
      { kind: 'numbered', start: 1, items: [[plain('B')]] },
    ]);
  });

  it('ends a list at a text line', () => {
    expect(parseMarkdown('- A\nThat is all.')).toEqual([
      { kind: 'bullets', items: [[plain('A')]] },
      { kind: 'paragraph', lines: [[plain('That is all.')]] },
    ]);
  });

  it('does not take a negative amount or a bold start for a bullet', () => {
    expect(parseMarkdown('-50 ₾ a month\n**Tip:** cook')).toEqual([
      { kind: 'paragraph', lines: [[plain('-50 ₾ a month')], [bold('Tip:'), plain(' cook')]] },
    ]);
  });

  it('reads a heading as a bold line', () => {
    expect(parseMarkdown('## Your week')).toEqual([{ kind: 'paragraph', lines: [[bold('Your week')]] }]);
  });

  it('handles Windows line endings and surrounding blank lines', () => {
    expect(parseMarkdown('\r\nHi\r\nthere\r\n')).toEqual([{ kind: 'paragraph', lines: [[plain('Hi')], [plain('there')]] }]);
  });

  it('gives nothing for empty text', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(' \n ')).toEqual([]);
  });
});

describe('markdownToPlainText', () => {
  it('drops the markup and keeps the structure as line breaks', () => {
    expect(markdownToPlainText('You have **323 ₾**.\n\n- Cook\n- Walk')).toBe('You have 323 ₾.\n\nCook\nWalk');
  });
});
