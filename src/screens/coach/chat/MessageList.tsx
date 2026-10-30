import { useRef, useState } from 'react';
import { TypingIndicator } from '../../../design/index.ts';
import type { CoachScript, FinanceTransaction } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { useEntranceAnimation } from '../shared/useEntranceAnimation.ts';
import { ChatMessageView } from './ChatMessageView.tsx';
import { visibleMessages, type ConversationState } from './conversation.ts';
import { spokenReply } from './replyText.ts';

interface MessageListProps {
  state: ConversationState;
  script: CoachScript;
  onShowTransactions(transactions: readonly FinanceTransaction[]): void;
}

function TypingRow() {
  const ref = useRef<HTMLDivElement>(null);
  useEntranceAnimation(ref, true);
  return (
    <div ref={ref}>
      <TypingIndicator />
    </div>
  );
}

/**
 * The conversation: messages, Luka typing, and a polite live region that reads each finished reply.
 * The bubbles themselves are not a live region, so a streaming answer isn't read out piece by piece.
 */
export function MessageList({ state, script, onShowTransactions }: MessageListProps) {
  const display = useDisplay();
  // Messages restored from earlier in the session are already "there": they neither animate nor get announced.
  const [firstNewId] = useState(state.nextId);
  const lastMessage = state.messages.at(-1);
  const announcement = lastMessage && lastMessage.id >= firstNewId ? spokenReply(lastMessage, script, display) : null;

  return (
    <>
      {visibleMessages(state.messages).map((message) => (
        <ChatMessageView
          key={message.id}
          message={message}
          script={script}
          isNew={message.id >= firstNewId}
          onShowTransactions={onShowTransactions}
        />
      ))}
      {state.isThinking && <TypingRow />}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
