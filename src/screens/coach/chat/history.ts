import type { CoachMessage } from '../../../../shared/coach.ts';
import type { CoachQuestion } from '../../../engine/index.ts';
import type { ChatContent, ChatMessage } from './conversation.ts';

/** The server only reads this many recent turns (server/ai/chat.ts), so the app sends no more. */
export const MAX_HISTORY_MESSAGES = 20;

/** The words of scripted messages in the current language; CoachScript provides them. */
export interface ScriptTexts {
  prompt(question: CoachQuestion): string;
  answer(question: CoachQuestion): string;
}

/**
 * The conversation as a coach request carries it: what the user asked and what Luka answered, in order.
 * The greeting and Luka's notices (offline, plan limit, errors) are app messages, not part of the
 * conversation, and empty answers are left out because the server rejects them.
 */
export function toCoachMessages(messages: readonly ChatMessage[], texts: ScriptTexts): CoachMessage[] {
  return messages.flatMap(({ content }) => {
    const message = toCoachMessage(content, texts);
    return message && message.content.trim() !== '' ? [message] : [];
  });
}

function toCoachMessage(content: ChatContent, texts: ScriptTexts): CoachMessage | null {
  switch (content.kind) {
    case 'question':
      return { role: 'user', content: texts.prompt(content.question) };
    case 'userText':
      return { role: 'user', content: content.text };
    case 'scriptedAnswer':
      return { role: 'assistant', content: texts.answer(content.question) };
    case 'aiAnswer':
      return { role: 'assistant', content: content.text };
    case 'greeting':
    case 'notice':
    case 'failure':
      return null;
  }
}

/** The most recent turns, starting with one of the user's, as the server would trim them anyway. */
export function recentHistory(messages: readonly CoachMessage[]): CoachMessage[] {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  const firstUserTurn = recent.findIndex((message) => message.role === 'user');
  return firstUserTurn === -1 ? [] : recent.slice(firstUserTurn);
}

/** The `messages` of a chat request for a conversation that ends with the user's new question. */
export function chatRequestMessages(messages: readonly ChatMessage[], texts: ScriptTexts): CoachMessage[] {
  return recentHistory(toCoachMessages(messages, texts));
}
