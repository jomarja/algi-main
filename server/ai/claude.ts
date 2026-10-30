import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from '../http.ts';
import { coachDataMessage } from './prompts.ts';

/** How the coach talks to Claude: the SDK surface it uses, the settings every request shares, and error mapping. */

/** The parts of a Claude reply the coach reads. */
export type ClaudeReply = Pick<Anthropic.Beta.BetaMessage, 'content' | 'model' | 'stop_reason'>;

export interface ClaudeReplyStream extends AsyncIterable<Anthropic.Beta.BetaRawMessageStreamEvent> {
  finalMessage(): Promise<ClaudeReply>;
}

/** The slice of `client.beta.messages` the coach uses, so tests can substitute it. */
export interface ClaudeMessages {
  stream(params: Anthropic.Beta.MessageCreateParamsStreaming, options: { signal: AbortSignal }): ClaudeReplyStream;
  create(params: Anthropic.Beta.MessageCreateParamsNonStreaming, options: { signal: AbortSignal }): Promise<ClaudeReply>;
}

export function createClaudeMessages(apiKey: string): ClaudeMessages {
  return new Anthropic({ apiKey }).beta.messages;
}

/**
 * Server-side refusal fallback: if a safety classifier declines a request, the API retries it on the model
 * Anthropic recommends for that refusal category, inside the same call, so a false positive doesn't
 * become an error in the app.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type SharedParams = Pick<Anthropic.Beta.MessageCreateParamsNonStreaming, 'model' | 'betas' | 'fallbacks' | 'thinking'>;

/** Settings every coach request uses. Effort is chosen per route. */
export function sharedParams(model: string): SharedParams {
  return {
    model,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
  };
}

/** A text block that ends a cacheable prefix. */
export function cachedText(text: string): Anthropic.Beta.BetaTextBlockParam {
  return { type: 'text', text, cache_control: { type: 'ephemeral' } };
}

/**
 * The per-request data as a mid-conversation system message. It goes last, after the cache breakpoints,
 * so new bank data never invalidates the cached system prompt or conversation.
 */
export function dataMessage(coachData: string): Anthropic.Beta.BetaSystemMessageParam {
  return { role: 'system', content: coachDataMessage(coachData) };
}

/** Maps a failed Claude call to the error the app sees. The app falls back to Luka's script on any of them. */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof Anthropic.RateLimitError) return new HttpError(429, 'rate_limited');
  // APIConnectionError and InternalServerError (5xx, including overloaded) are worth retrying later.
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) {
    return new HttpError(503, 'ai_unavailable');
  }
  if (error instanceof Anthropic.APIError) return new HttpError(502, 'ai_error');
  return new HttpError(500, 'internal_error');
}

/** Logs a failure without the conversation or the user's data. */
export function logClaudeFailure(route: string, error: unknown): void {
  if (error instanceof Anthropic.APIError) {
    console.error(`[coach] ${route}: Claude request failed (status ${error.status ?? 'none'}, request ${error.requestID ?? 'unknown'}): ${error.message}`);
  } else if (error instanceof HttpError) {
    console.error(`[coach] ${route}: ${error.code}: ${error.message}`);
  } else {
    console.error(`[coach] ${route} failed`, error);
  }
}
