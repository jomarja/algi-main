import { memo, useRef } from 'react';
import { ButtonLink, ChatBubble } from '../../../design/index.ts';
import { SAMPLE_PROFILE, type CoachScript, type Display, type FinanceTransaction } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { coachFailureMessage } from '../shared/coachErrors.ts';
import { useEntranceAnimation } from '../shared/useEntranceAnimation.ts';
import { AiAnswerBubble } from './AiAnswerBubble.tsx';
import type { ChatContent, ChatMessage } from './conversation.ts';
import { noticeText } from './replyText.ts';
import { ScriptedAnswerBubble } from './ScriptedAnswerBubble.tsx';

interface ChatMessageViewProps {
  message: ChatMessage;
  script: CoachScript;
  /** Animates in; false for messages restored when the screen opens. */
  isNew: boolean;
  onShowTransactions(transactions: readonly FinanceTransaction[]): void;
}

interface MessageContentProps {
  content: ChatContent;
  script: CoachScript;
  display: Display;
  onShowTransactions(transactions: readonly FinanceTransaction[]): void;
}

function MessageContent({ content, script, display, onShowTransactions }: MessageContentProps) {
  switch (content.kind) {
    case 'greeting':
      return <ChatBubble role="coach" text={script.greeting(display.text(SAMPLE_PROFILE.firstName))} />;
    case 'question':
      return <ChatBubble role="user" text={script.prompt(content.question)} />;
    case 'userText':
      return <ChatBubble role="user" text={content.text} />;
    case 'scriptedAnswer':
      return <ScriptedAnswerBubble reply={script.reply(content.question)} onShowTransactions={onShowTransactions} />;
    case 'aiAnswer':
      return <AiAnswerBubble text={content.text} status={content.status} />;
    case 'notice':
      return content.notice === 'limitReached' ? (
        <ChatBubble role="coach" text={script.limitReached}>
          <ButtonLink to="/paywall">{display.t('See Premium', 'Premium-ის ნახვა')}</ButtonLink>
        </ChatBubble>
      ) : (
        <ChatBubble role="coach" text={noticeText(content.notice, script)} />
      );
    case 'failure':
      return <ChatBubble role="coach" text={display.text(coachFailureMessage(content.failure))} />;
  }
}

/** One message of the conversation. Memoised: while an answer streams, only that answer re-renders. */
export const ChatMessageView = memo(function ChatMessageView({ message, script, isNew, onShowTransactions }: ChatMessageViewProps) {
  const display = useDisplay();
  const ref = useRef<HTMLDivElement>(null);
  useEntranceAnimation(ref, isNew);

  return (
    <div ref={ref}>
      <MessageContent content={message.content} script={script} display={display} onShowTransactions={onShowTransactions} />
    </div>
  );
});
