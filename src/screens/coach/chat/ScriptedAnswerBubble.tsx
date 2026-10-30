import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChatBubble, Icon, Tag } from '../../../design/index.ts';
import type { CoachReply, FinanceTransaction } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { useEntranceAnimation } from '../shared/useEntranceAnimation.ts';

interface ScriptedAnswerBubbleProps {
  reply: CoachReply;
  onShowTransactions(transactions: readonly FinanceTransaction[]): void;
}

interface BubbleActionProps {
  icon: string;
  onClick(): void;
  children: ReactNode;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
}

/** A link-style button inside a bubble; its tap area reaches past the text without changing the layout. */
function BubbleAction({ icon, onClick, children, ...aria }: BubbleActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-footnote pressable-dim relative inline-flex items-center gap-1 font-semibold text-mintDark after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']"
      {...aria}
    >
      <Icon name={icon} size={13} />
      {children}
    </button>
  );
}

function Reasoning({ id, text }: { id: string; text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEntranceAnimation(ref, true);
  return (
    <p ref={ref} id={id} className="type-footnote w-full rounded-sm bg-cream p-3 text-inkSoft">
      {text}
    </p>
  );
}

/** A scripted answer with an expandable explanation and a link to the transactions behind it (CoachAnswerBubble). */
export function ScriptedAnswerBubble({ reply, onShowTransactions }: ScriptedAnswerBubbleProps) {
  const display = useDisplay();
  const [isExpanded, setExpanded] = useState(false);
  const reasoningId = useId();
  const transactionCount = reply.supportingTransactions.length;

  return (
    <ChatBubble role="coach" text={reply.text}>
      <div className="flex flex-col items-start gap-2">
        {reply.isEstimate && <Tag text={display.t('Estimate', 'შეფასება')} tone="estimate" />}
        {isExpanded && <Reasoning id={reasoningId} text={reply.reasoning} />}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <BubbleAction
            icon={isExpanded ? 'chevron.up' : 'chevron.down'}
            onClick={() => setExpanded((expanded) => !expanded)}
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? reasoningId : undefined}
          >
            {isExpanded ? display.t('Hide details', 'დეტალების დამალვა') : display.t('How I worked this out', 'როგორ დავითვალე')}
          </BubbleAction>
          {transactionCount > 0 && (
            <BubbleAction icon="list.bullet" onClick={() => onShowTransactions(reply.supportingTransactions)}>
              {display.t(`${transactionCount} transactions`, `${transactionCount} ტრანზაქცია`)}
            </BubbleAction>
          )}
        </div>
      </div>
    </ChatBubble>
  );
}
