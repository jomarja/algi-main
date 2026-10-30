import { describe, expect, it } from 'vitest';
import { formatEvent } from './sse.ts';

describe('formatEvent', () => {
  it('frames a text delta', () => {
    expect(formatEvent({ type: 'delta', text: 'Hi Nino' })).toBe('event: delta\ndata: {"text":"Hi Nino"}\n\n');
  });

  it('frames the end of a reply', () => {
    expect(formatEvent({ type: 'done', stopReason: 'end_turn' })).toBe('event: done\ndata: {"stopReason":"end_turn"}\n\n');
  });

  it('frames an error', () => {
    expect(formatEvent({ type: 'error', message: 'rate_limited' })).toBe('event: error\ndata: {"message":"rate_limited"}\n\n');
  });

  it('keeps multi-line text on one data line', () => {
    const frame = formatEvent({ type: 'delta', text: 'One\n\nTwo\r\nThree' });

    expect(frame.split('\n')).toEqual(['event: delta', 'data: {"text":"One\\n\\nTwo\\r\\nThree"}', '', '']);
  });

  it('keeps Georgian text and the lari sign readable', () => {
    expect(formatEvent({ type: 'delta', text: 'დღეს 42 ₾' })).toBe('event: delta\ndata: {"text":"დღეს 42 ₾"}\n\n');
  });
});
