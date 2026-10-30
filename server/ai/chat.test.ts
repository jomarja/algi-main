import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import type { CoachMessage } from '../../shared/coach.ts';
import { buildChatParams, recentConversation, streamChatReply } from './chat.ts';
import { LUKA_SYSTEM_PROMPT, coachDataMessage } from './prompts.ts';
import { fakeClaude, textDelta } from './test-fixtures.ts';
import { MAX_MESSAGE_CHARS } from './validation.ts';

const user = (content: string): CoachMessage => ({ role: 'user', content });
const luka = (content: string): CoachMessage => ({ role: 'assistant', content });

describe('buildChatParams', () => {
  const conversation = [luka('Hi Nino!'), user('How much can I spend today?'), luka('About 42 ₾.'), user('And this week?')];
  const params = buildChatParams('claude-opus-5-5', conversation, 'DATA');

  it('uses the configured model, adaptive thinking, low effort and streaming', () => {
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.thinking).toEqual({ type: 'adaptive' });
    expect(params.output_config).toEqual({ effort: 'low' });
    expect(params.stream).toBe(true);
    expect(params.max_tokens).toBeGreaterThanOrEqual(8_000);
  });

  it('opts into the server-side refusal fallback', () => {
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01']);
  });

  it('caches the fixed system prompt', () => {
    expect(params.system).toEqual([{ type: 'text', text: LUKA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]);
  });

  it("starts with the user's first turn and ends with the data as a system message", () => {
    expect(params.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'How much can I spend today?' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'About 42 ₾.' }] },
      { role: 'user', content: [{ type: 'text', text: 'And this week?', cache_control: { type: 'ephemeral' } }] },
      { role: 'system', content: coachDataMessage('DATA') },
    ]);
  });

  it('keeps everything before the data identical when only the data changes', () => {
    const later = buildChatParams('claude-opus-5-5', conversation, 'NEW DATA');
    expect(later.system).toEqual(params.system);
    expect(later.messages.slice(0, -1)).toEqual(params.messages.slice(0, -1));
  });
});

describe('recentConversation', () => {
  it('keeps the latest 20 messages, starting with a user turn', () => {
    const conversation = Array.from({ length: 30 }, (_, index) => (index % 2 === 0 ? user(`q${index}`) : luka(`a${index}`)));
    conversation.push(user('latest'));

    const recent = recentConversation(conversation);

    expect(recent).toHaveLength(19);
    expect(recent[0]).toEqual(user('q12'));
    expect(recent[recent.length - 1]).toEqual(user('latest'));
  });

  it("clips Luka's long replies but never the user's", () => {
    const long = 'a'.repeat(MAX_MESSAGE_CHARS + 500);
    const recent = recentConversation([user(long), luka(long), user('ok')]);

    expect(recent[0].content).toHaveLength(long.length);
    expect(Array.from(recent[1].content)).toHaveLength(MAX_MESSAGE_CHARS);
    expect(recent[1].content.endsWith('…')).toBe(true);
  });
});

describe('streamChatReply', () => {
  const params = buildChatParams('claude-opus-5-5', [user('Hi')], 'DATA');

  it('passes on text as it arrives and returns the stop reason', async () => {
    const claude = fakeClaude({
      events: [
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig' } },
        { type: 'content_block_stop', index: 0 },
        textDelta('Hello'),
        textDelta(''),
        textDelta(', Nino'),
        { type: 'message_stop' },
      ],
    });
    const received: string[] = [];

    const stopReason = await streamChatReply(claude, params, new AbortController().signal, (text) => received.push(text));

    expect(received).toEqual(['Hello', ', Nino']);
    expect(stopReason).toBe('end_turn');
  });

  it('reports a refusal from every model as the stop reason', async () => {
    const claude = fakeClaude({ events: [textDelta('Partial')], stopReason: 'refusal' });
    expect(await streamChatReply(claude, params, new AbortController().signal, () => {})).toBe('refusal');
  });

  it('sends the request with the abort signal', async () => {
    const claude = fakeClaude();
    const controller = new AbortController();

    await streamChatReply(claude, params, controller.signal, () => {});

    expect(claude.streamCalls).toHaveLength(1);
    expect(claude.streamCalls[0].params).toBe(params);
    expect(claude.streamCalls[0].signal).toBe(controller.signal);
  });

  it('lets API errors through for the caller to report', async () => {
    const error = new Anthropic.RateLimitError(429, { type: 'error' }, 'slow down', new Headers());
    const claude = fakeClaude({ error });

    await expect(streamChatReply(claude, params, new AbortController().signal, () => {})).rejects.toBe(error);
  });
});
