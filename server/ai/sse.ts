import type { ServerResponse } from 'node:http';
import type { CoachStreamEvent } from '../../shared/coach.ts';

/** Server-Sent Events framing for POST /api/coach/chat, as documented on CoachStreamEvent. */

export function openEventStream(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    // Stops nginx from buffering the stream, so text reaches the phone as it is written.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
}

/** One event. JSON keeps the data on a single line, whatever newlines the text contains. */
export function formatEvent(event: CoachStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(eventData(event))}\n\n`;
}

export function writeEvent(res: ServerResponse, event: CoachStreamEvent): void {
  res.write(formatEvent(event));
}

function eventData(event: CoachStreamEvent): Record<string, string> {
  switch (event.type) {
    case 'delta':
      return { text: event.text };
    case 'done':
      return { stopReason: event.stopReason };
    case 'error':
      return { message: event.message };
  }
}
