import type {
  CoachChatRequest,
  CoachRecommendationsRequest,
  CoachRecommendationsResponse,
  CoachStatus,
} from '../../shared/coach.ts';
import { ApiError, requestJson, send } from './http.ts';
import { createSseParser, toCoachEvent } from './sse.ts';

export interface StreamChatOptions {
  /** Called with each piece of Luka's answer as it arrives. */
  onDelta(text: string): void;
  signal?: AbortSignal;
}

export interface StreamChatResult {
  stopReason: string;
}

/** Time to the first byte of the answer. */
const chatConnectTimeoutMs = 30_000;
/** A stream that goes quiet this long is treated as broken. */
const streamIdleTimeoutMs = 45_000;
/** Recommendations come back in one piece, after the model has finished thinking. */
const recommendationsTimeoutMs = 60_000;

/** The AI coach endpoints (contract in shared/coach.ts). */
export class HttpCoachApi {
  status(): Promise<CoachStatus> {
    return requestJson<CoachStatus>('/api/coach/status');
  }

  recommendations(request: CoachRecommendationsRequest): Promise<CoachRecommendationsResponse> {
    return requestJson<CoachRecommendationsResponse>('/api/coach/recommendations', {
      method: 'POST',
      body: request,
      timeoutMs: recommendationsTimeoutMs,
    });
  }

  /**
   * Streams Luka's answer from POST /api/coach/chat, calling `onDelta` per piece. Resolves when the server
   * sends `done`; rejects with an ApiError of kind 'stream' on an `error` event, 'aborted' when `signal` fires,
   * and 'timeout' or 'network' when the stream stalls or breaks.
   */
  async streamChat(request: CoachChatRequest, { onDelta, signal }: StreamChatOptions): Promise<StreamChatResult> {
    const response = await send('/api/coach/chat', {
      method: 'POST',
      body: request,
      signal,
      timeoutMs: chatConnectTimeoutMs,
      accept: 'text/event-stream',
    });
    if (!response.body) throw new ApiError('invalid_response', 'The coach answered without a stream');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    let isIdle = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const restartIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isIdle = true;
        void reader.cancel();
      }, streamIdleTimeoutMs);
    };

    try {
      for (;;) {
        restartIdleTimer();
        const { done, value } = await reader.read();
        const messages = done ? parser.finish() : parser.push(decoder.decode(value, { stream: true }));
        for (const message of messages) {
          const event = toCoachEvent(message);
          if (event?.type === 'delta') onDelta(event.text);
          else if (event?.type === 'done') return { stopReason: event.stopReason };
          else if (event?.type === 'error') throw new ApiError('stream', event.message, { code: event.message });
        }
        if (done) {
          if (isIdle) throw new ApiError('timeout', `The coach went quiet for ${streamIdleTimeoutMs} ms`);
          throw new ApiError('invalid_response', 'The coach stream ended before it finished');
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (signal?.aborted) throw new ApiError('aborted', 'The coach answer was cancelled', { cause: error });
      throw new ApiError('network', 'The coach stream broke off', { cause: error });
    } finally {
      clearTimeout(idleTimer);
      reader.cancel().catch(() => undefined);
    }
  }
}
