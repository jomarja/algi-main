import type Anthropic from '@anthropic-ai/sdk';
import type { CoachMessage } from '../../shared/coach.ts';
import { type ClaudeMessages, cachedText, dataMessage, sharedParams } from './claude.ts';
import { clip } from './format.ts';
import { LUKA_SYSTEM_PROMPT } from './prompts.ts';
import { MAX_MESSAGE_CHARS } from './validation.ts';

/**
 * Chat with Luka. `low` effort: replies are short and latency matters more than depth here; the figures
 * Luka needs are already computed in the data block. Raise to `medium` if answers start missing nuance.
 */
const CHAT_EFFORT = 'low';
/** Room for adaptive thinking plus a phone-sized reply, with a ceiling on runaway cost. */
const CHAT_MAX_TOKENS = 16_000;
/** Older turns add cost and little value to a short coaching chat. */
const MAX_HISTORY_MESSAGES = 20;

export function buildChatParams(
  model: string,
  conversation: readonly CoachMessage[],
  coachData: string,
): Anthropic.Beta.MessageCreateParamsStreaming {
  const history = recentConversation(conversation);
  const latest = history.length - 1;
  return {
    ...sharedParams(model),
    max_tokens: CHAT_MAX_TOKENS,
    stream: true,
    output_config: { effort: CHAT_EFFORT },
    // Cache breakpoints: the system prompt (shared by every user), then the newest user turn, so the
    // next request reads the whole conversation so far from the cache.
    system: [cachedText(LUKA_SYSTEM_PROMPT)],
    messages: [...history.map((message, index) => toApiMessage(message, index === latest)), dataMessage(coachData)],
  };
}

/**
 * The turns sent to Claude: the most recent ones, starting with a user turn as the API requires
 * (the app's greeting from Luka is dropped), with Luka's own older replies clipped to the message limit.
 * Assumes a validated conversation, which always ends with a user turn.
 */
export function recentConversation(conversation: readonly CoachMessage[]): CoachMessage[] {
  const recent = conversation.slice(-MAX_HISTORY_MESSAGES);
  const firstUserTurn = Math.max(recent.findIndex((message) => message.role === 'user'), 0);
  return recent
    .slice(firstUserTurn)
    .map((message) => (message.role === 'assistant' ? { ...message, content: clip(message.content, MAX_MESSAGE_CHARS) } : message));
}

function toApiMessage(message: CoachMessage, endsCachedPrefix: boolean): Anthropic.Beta.BetaMessageParam {
  // Every turn is sent as a text block, so a turn's bytes stay the same when its breakpoint moves on.
  const block: Anthropic.Beta.BetaTextBlockParam = endsCachedPrefix
    ? cachedText(message.content)
    : { type: 'text', text: message.content };
  return message.role === 'user' ? { role: 'user', content: [block] } : { role: 'assistant', content: [block] };
}

/**
 * Streams Luka's reply, passing each piece of text on as it arrives. Thinking and fallback markers are
 * not shown. Resolves with the stop reason: `refusal` means every model declined, and any text already
 * sent should be discarded; `max_tokens` means the reply was cut short.
 */
export async function streamChatReply(
  claude: ClaudeMessages,
  params: Anthropic.Beta.MessageCreateParamsStreaming,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<string> {
  const stream = claude.stream(params, { signal });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && event.delta.text) {
      onText(event.delta.text);
    }
  }
  const reply = await stream.finalMessage();
  return reply.stop_reason ?? 'end_turn';
}
