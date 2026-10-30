import type { CoachStreamEvent } from '../../shared/coach.ts';

/** One Server-Sent Events message. */
export interface SseMessage {
  event: string;
  data: string;
}

export interface SseParser {
  /** Adds decoded text and returns the messages it completed. */
  push(chunk: string): SseMessage[];
  /** Flushes a final message that wasn't followed by a blank line. */
  finish(): SseMessage[];
}

const messageBoundary = /\r\n\r\n|\n\n|\r\r/;

function parseMessage(block: string): SseMessage | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r\n|\n|\r/)) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null;
}

/** Incremental parser for `event:` / `data:` streams; chunks may split anywhere, even inside a line. */
export function createSseParser(): SseParser {
  let buffer = '';

  const drain = (): SseMessage[] => {
    const messages: SseMessage[] = [];
    let boundary = messageBoundary.exec(buffer);
    while (boundary) {
      const message = parseMessage(buffer.slice(0, boundary.index));
      if (message) messages.push(message);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      boundary = messageBoundary.exec(buffer);
    }
    return messages;
  };

  return {
    push(chunk) {
      buffer += chunk;
      return drain();
    },
    finish() {
      const messages = drain();
      const last = parseMessage(buffer);
      buffer = '';
      return last ? [...messages, last] : messages;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads a coach stream message (contract in shared/coach.ts); unknown or malformed messages give null. */
export function toCoachEvent(message: SseMessage): CoachStreamEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(message.data);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  switch (message.event) {
    case 'delta':
      return typeof data.text === 'string' ? { type: 'delta', text: data.text } : null;
    case 'done':
      return { type: 'done', stopReason: typeof data.stopReason === 'string' ? data.stopReason : 'end_turn' };
    case 'error':
      return { type: 'error', message: typeof data.message === 'string' ? data.message : 'The coach could not answer.' };
    default:
      return null;
  }
}
