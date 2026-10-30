import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../http.ts';
import { createClaudeMessages, dataMessage, sharedParams, toHttpError } from './claude.ts';
import { coachDataMessage } from './prompts.ts';

const headers = new Headers({ 'request-id': 'req_test' });

describe('toHttpError', () => {
  it.each([
    ['a rate limit', new Anthropic.RateLimitError(429, { type: 'error' }, 'slow down', headers), 429, 'rate_limited'],
    ['an overloaded API', new Anthropic.InternalServerError(529, { type: 'error' }, 'overloaded', headers), 503, 'ai_unavailable'],
    ['a network failure', new Anthropic.APIConnectionError({ message: 'socket hang up' }), 503, 'ai_unavailable'],
    ['a timeout', new Anthropic.APIConnectionTimeoutError(), 503, 'ai_unavailable'],
    ['a bad API key', new Anthropic.AuthenticationError(401, { type: 'error' }, 'invalid x-api-key', headers), 502, 'ai_error'],
    ['a rejected request', new Anthropic.BadRequestError(400, { type: 'error' }, 'invalid request', headers), 502, 'ai_error'],
    ['a bug in our code', new TypeError('oops'), 500, 'internal_error'],
  ])('maps %s', (_case, error, status, code) => {
    const mapped = toHttpError(error);
    expect(mapped.status).toBe(status);
    expect(mapped.code).toBe(code);
  });

  it('keeps an HttpError as it is', () => {
    const error = new HttpError(502, 'ai_refused');
    expect(toHttpError(error)).toBe(error);
  });
});

describe('request settings', () => {
  it('shares the model, adaptive thinking and the default refusal fallback', () => {
    expect(sharedParams('claude-opus-5-5')).toEqual({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
    });
  });

  it('sends the data as a mid-conversation system message', () => {
    expect(dataMessage('DATA')).toEqual({ role: 'system', content: coachDataMessage('DATA') });
  });

  it('builds a client without making a request', () => {
    const messages = createClaudeMessages('test-key');
    expect(typeof messages.stream).toBe('function');
    expect(typeof messages.create).toBe('function');
  });
});
