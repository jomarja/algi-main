import { Fragment, memo, useMemo } from 'react';
import { parseMarkdown, type InlineLine, type MarkdownBlock } from './markdown.ts';

function Line({ line }: { line: InlineLine }) {
  return (
    <>
      {line.map((span, index) =>
        span.isBold ? (
          <strong key={index} className="font-bold">
            {span.text}
          </strong>
        ) : (
          <Fragment key={index}>{span.text}</Fragment>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p>
          {block.lines.map((line, index) => (
            <Fragment key={index}>
              {index > 0 && <br />}
              <Line line={line} />
            </Fragment>
          ))}
        </p>
      );
    case 'bullets':
      return (
        <ul className="list-disc space-y-1 pl-5 marker:text-mint">
          {block.items.map((item, index) => (
            <li key={index}>
              <Line line={item} />
            </li>
          ))}
        </ul>
      );
    case 'numbered':
      return (
        <ol start={block.start} className="list-decimal space-y-1 pl-5 marker:font-semibold marker:text-mintDark">
          {block.items.map((item, index) => (
            <li key={index}>
              <Line line={item} />
            </li>
          ))}
        </ol>
      );
  }
}

/** Luka's answer with its light markdown (see markdown.ts). Only text nodes are rendered, never HTML. */
export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="type-callout flex flex-col gap-2 break-words">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
});
