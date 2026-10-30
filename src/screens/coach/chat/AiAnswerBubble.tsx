import { memo } from 'react';
import { MascotAvatar, Tag } from '../../../design/index.ts';
import type { TagTone } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import type { AiAnswerStatus } from './conversation.ts';
import { MarkdownText } from './MarkdownText.tsx';

interface StatusTag {
  readonly en: string;
  readonly ka: string;
  readonly tone: TagTone;
}

/** How an answer that didn't finish normally is labelled. */
const statusTags: Readonly<Partial<Record<AiAnswerStatus, StatusTag>>> = {
  cutShort: { en: 'Cut short', ka: 'შემოკლებულია', tone: 'attention' },
  stopped: { en: 'Stopped', ka: 'შეჩერებულია', tone: 'neutral' },
  interrupted: { en: 'Interrupted', ka: 'შეწყვეტილია', tone: 'neutral' },
};

interface AiAnswerBubbleProps {
  text: string;
  status: AiAnswerStatus;
}

/**
 * Luka's AI answer: the design system's coach bubble (ChatBubble) with formatted text, since ChatBubble only
 * takes plain text. While it streams, the text grows in place; the bubble only ever gets taller.
 */
export const AiAnswerBubble = memo(function AiAnswerBubble({ text, status }: AiAnswerBubbleProps) {
  const display = useDisplay();
  const tag = statusTags[status];

  return (
    <div className="flex items-end gap-2 pr-6">
      <MascotAvatar size={32} decorative />
      <div
        aria-busy={status === 'streaming' || undefined}
        className="flex min-w-0 flex-col items-start gap-3 rounded-[20px] rounded-bl-[6px] border border-line bg-surface px-4 py-3 text-ink"
      >
        <span className="sr-only">{display.t('Luka:', 'ლუკა:')}</span>
        <MarkdownText text={text} />
        {tag && <Tag text={display.t(tag.en, tag.ka)} tone={tag.tone} />}
      </div>
    </div>
  );
});
