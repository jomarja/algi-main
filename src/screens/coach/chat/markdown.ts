/**
 * The little markdown Luka writes (server/ai/prompts.ts asks for short paragraphs, a few bullets and at most one
 * bold figure): paragraphs with line breaks, bullet and numbered lists, and **bold**. Everything else stays text.
 * The result is plain data that renders as React text nodes, so nothing in an answer can become HTML.
 */

export interface InlineSpan {
  readonly text: string;
  readonly isBold: boolean;
}

export type InlineLine = readonly InlineSpan[];

export type MarkdownBlock =
  | { readonly kind: 'paragraph'; readonly lines: readonly InlineLine[] }
  | { readonly kind: 'bullets'; readonly items: readonly InlineLine[] }
  | { readonly kind: 'numbered'; readonly start: number; readonly items: readonly InlineLine[] };

const bulletLine = /^\s*[-*•]\s+(.*)$/;
const numberedLine = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const headingLine = /^\s*#{1,6}\s+(.*)$/;
const boldSpan = /\*\*(.+?)\*\*/g;

type LineKind =
  | { kind: 'blank' }
  | { kind: 'text'; line: InlineLine }
  | { kind: 'bullet'; item: InlineLine }
  | { kind: 'numbered'; number: number; item: InlineLine };

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: InlineLine[] = [];
  let list: { kind: 'bullets'; items: InlineLine[] } | { kind: 'numbered'; start: number; items: InlineLine[] } | null = null;

  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  const closeList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const rawLine of source.split(/\r\n|\r|\n/)) {
    const line = classifyLine(rawLine);
    switch (line.kind) {
      case 'blank':
        closeParagraph();
        closeList();
        break;
      case 'text':
        closeList();
        paragraph.push(line.line);
        break;
      case 'bullet':
        closeParagraph();
        if (list?.kind !== 'bullets') {
          closeList();
          list = { kind: 'bullets', items: [] };
        }
        list.items.push(line.item);
        break;
      case 'numbered':
        closeParagraph();
        if (list?.kind !== 'numbered') {
          closeList();
          list = { kind: 'numbered', start: line.number, items: [] };
        }
        list.items.push(line.item);
        break;
    }
  }
  closeParagraph();
  closeList();
  return blocks;
}

function classifyLine(rawLine: string): LineKind {
  const line = rawLine.trim();
  if (line === '') return { kind: 'blank' };
  const bullet = bulletLine.exec(line);
  if (bullet) return { kind: 'bullet', item: parseInline(bullet[1]) };
  const numbered = numberedLine.exec(line);
  if (numbered) return { kind: 'numbered', number: Number(numbered[1]), item: parseInline(numbered[2]) };
  const heading = headingLine.exec(line);
  // Luka is asked not to use headings; if one slips through it reads as a bold line.
  if (heading) return { kind: 'text', line: parseInline(heading[1]).map((span) => ({ ...span, isBold: true })) };
  return { kind: 'text', line: parseInline(line) };
}

/**
 * Splits a line into plain and bold spans. A `**` without its partner (half-way through a stream, or a typo)
 * is dropped rather than shown, so a figure turns bold when its closing marker arrives instead of flashing stars.
 */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const push = (value: string, isBold: boolean) => {
    const cleaned = isBold ? value : value.replaceAll('**', '');
    if (cleaned === '') return;
    const previous = spans.at(-1);
    if (previous && previous.isBold === isBold) spans[spans.length - 1] = { text: previous.text + cleaned, isBold };
    else spans.push({ text: cleaned, isBold });
  };

  // A fresh expression per call: a shared global regex would carry `lastIndex` from one call into the next.
  const pattern = new RegExp(boldSpan);
  let consumed = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    push(text.slice(consumed, match.index), false);
    push(match[1], true);
    consumed = match.index + match[0].length;
  }
  push(text.slice(consumed), false);
  return spans;
}

function lineText(line: InlineLine): string {
  return line.map((span) => span.text).join('');
}

/** The answer without markup, for screen-reader announcements. */
export function markdownToPlainText(source: string): string {
  return parseMarkdown(source)
    .map((block) => (block.kind === 'paragraph' ? block.lines : block.items).map(lineText).join('\n'))
    .join('\n\n');
}
