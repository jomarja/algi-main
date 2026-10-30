import type { CoachScript, Display } from '../../../engine/index.ts';
import { coachFailureMessage } from '../shared/coachErrors.ts';
import type { ChatMessage, CoachNotice } from './conversation.ts';
import { markdownToPlainText } from './markdown.ts';

export function noticeText(notice: CoachNotice, script: CoachScript): string {
  switch (notice) {
    case 'unsupported':
      return script.unsupportedQuestion;
    case 'coachingDataOff':
      return script.coachingDataOff;
    case 'limitReached':
      return script.limitReached;
  }
}

/** What a screen reader hears when Luka's reply is complete; a streamed answer is read once, when it ends. */
export function spokenReply(message: ChatMessage, script: CoachScript, display: Display): string | null {
  const { content } = message;
  switch (content.kind) {
    case 'scriptedAnswer':
      return script.reply(content.question).text;
    case 'aiAnswer':
      return content.status === 'streaming' ? null : markdownToPlainText(content.text);
    case 'notice':
      return noticeText(content.notice, script);
    case 'failure':
      return display.text(coachFailureMessage(content.failure));
    case 'greeting':
    case 'question':
    case 'userText':
      return null;
  }
}
