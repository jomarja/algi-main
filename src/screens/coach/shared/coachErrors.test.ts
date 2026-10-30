import { ApiError } from '../../../api/http.ts';
import { classifyCoachError, coachFailureMessage, isFailureNotice, type CoachFailureNotice } from './coachErrors.ts';

describe('classifyCoachError', () => {
  it('reads the error code of a stream error event', () => {
    expect(classifyCoachError(new ApiError('stream', 'rate_limited', { code: 'rate_limited' }))).toBe('rateLimited');
    expect(classifyCoachError(new ApiError('stream', 'ai_unavailable', { code: 'ai_unavailable' }))).toBe('offline');
    expect(classifyCoachError(new ApiError('stream', 'ai_error', { code: 'ai_error' }))).toBe('aiError');
    expect(classifyCoachError(new ApiError('stream', 'internal_error', { code: 'internal_error' }))).toBe('aiError');
  });

  it('maps bank error codes', () => {
    expect(classifyCoachError(new ApiError('stream', 'not_connected', { code: 'not_connected' }))).toBe('bankNotConnected');
    expect(classifyCoachError(new ApiError('stream', 'bank_unreachable', { code: 'bank_unreachable' }))).toBe('bankUnavailable');
    expect(classifyCoachError(new ApiError('stream', 'bank_unavailable', { code: 'bank_unavailable' }))).toBe('bankUnavailable');
    expect(classifyCoachError(new ApiError('stream', 'bank_request_rejected', { code: 'bank_request_rejected' }))).toBe('bankUnavailable');
    expect(classifyCoachError(new ApiError('stream', 'bank_rate_limited', { code: 'bank_rate_limited' }))).toBe('bankRateLimited');
  });

  it('reads the code of an error status', () => {
    expect(classifyCoachError(new ApiError('http', 'x', { status: 503, code: 'ai_unavailable' }))).toBe('offline');
    expect(classifyCoachError(new ApiError('http', 'x', { status: 429, code: 'rate_limited' }))).toBe('rateLimited');
    expect(classifyCoachError(new ApiError('http', 'x', { status: 400, code: 'message_too_long' }))).toBe('tooLong');
    expect(classifyCoachError(new ApiError('http', 'x', { status: 413, code: 'payload_too_large' }))).toBe('tooLong');
    expect(classifyCoachError(new ApiError('http', 'x', { status: 400, code: 'invalid_request' }))).toBe('aiError');
  });

  it("treats a gateway's error page as offline", () => {
    expect(classifyCoachError(new ApiError('http', 'x', { status: 502, code: 'http_502' }))).toBe('offline');
    expect(classifyCoachError(new ApiError('http', 'x', { status: 504, code: 'http_504' }))).toBe('offline');
    expect(classifyCoachError(new ApiError('http', 'x', { status: 500, code: 'http_500' }))).toBe('aiError');
  });

  it('treats a broken or stalled connection as offline', () => {
    expect(classifyCoachError(new ApiError('network', 'x'))).toBe('offline');
    expect(classifyCoachError(new ApiError('timeout', 'x'))).toBe('offline');
  });

  it('recognises a cancellation', () => {
    expect(classifyCoachError(new ApiError('aborted', 'x'))).toBe('cancelled');
  });

  it('falls back to a generic AI error', () => {
    expect(classifyCoachError(new ApiError('invalid_response', 'x'))).toBe('aiError');
    expect(classifyCoachError(new ApiError('stream', 'The coach could not answer.'))).toBe('aiError');
    expect(classifyCoachError(new TypeError('boom'))).toBe('aiError');
  });
});

describe('isFailureNotice', () => {
  it('explains every failure except going offline or cancelling', () => {
    expect(isFailureNotice('rateLimited')).toBe(true);
    expect(isFailureNotice('bankNotConnected')).toBe(true);
    expect(isFailureNotice('offline')).toBe(false);
    expect(isFailureNotice('cancelled')).toBe(false);
  });
});

describe('coachFailureMessage', () => {
  const notices: CoachFailureNotice[] = ['rateLimited', 'aiError', 'bankNotConnected', 'bankUnavailable', 'bankRateLimited', 'tooLong'];

  it('has copy in both languages for every notice', () => {
    for (const notice of notices) {
      const message = coachFailureMessage(notice);
      expect(message.en.length).toBeGreaterThan(0);
      expect(message.ka.length).toBeGreaterThan(0);
      expect(message.ka).not.toBe(message.en);
    }
  });

  it('states the message limit the way each language writes numbers', () => {
    const message = coachFailureMessage('tooLong');
    expect(message.en).toContain('4,000');
    expect(message.ka).toMatch(/4\s000/);
  });
});
