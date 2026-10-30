import { createSseParser, toCoachEvent } from './sse.ts';

describe('createSseParser', () => {
  it('parses complete messages', () => {
    const parser = createSseParser();
    expect(parser.push('event: delta\ndata: {"text":"Hi"}\n\nevent: done\ndata: {"stopReason":"end_turn"}\n\n')).toEqual([
      { event: 'delta', data: '{"text":"Hi"}' },
      { event: 'done', data: '{"stopReason":"end_turn"}' },
    ]);
  });

  it('waits for the rest of a message split across chunks', () => {
    const parser = createSseParser();
    expect(parser.push('event: del')).toEqual([]);
    expect(parser.push('ta\ndata: {"te')).toEqual([]);
    expect(parser.push('xt":"Hi"}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ event: 'delta', data: '{"text":"Hi"}' }]);
  });

  it('accepts CRLF line endings, even split between chunks', () => {
    const parser = createSseParser();
    expect(parser.push('event: delta\r\ndata: {"text":"A"}\r\n\r')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ event: 'delta', data: '{"text":"A"}' }]);
  });

  it('joins multi-line data and strips one leading space', () => {
    const parser = createSseParser();
    expect(parser.push('data: first\ndata:second\n\n')).toEqual([{ event: 'message', data: 'first\nsecond' }]);
  });

  it('skips comments and messages without data', () => {
    const parser = createSseParser();
    expect(parser.push(': keep-alive\n\nevent: ping\n\n')).toEqual([]);
  });

  it('flushes a last message that has no trailing blank line', () => {
    const parser = createSseParser();
    expect(parser.push('event: done\ndata: {}')).toEqual([]);
    expect(parser.finish()).toEqual([{ event: 'done', data: '{}' }]);
  });
});

describe('toCoachEvent', () => {
  it('reads a delta', () => {
    expect(toCoachEvent({ event: 'delta', data: '{"text":"Hello"}' })).toEqual({ type: 'delta', text: 'Hello' });
  });

  it('reads done, defaulting the stop reason', () => {
    expect(toCoachEvent({ event: 'done', data: '{"stopReason":"max_tokens"}' })).toEqual({ type: 'done', stopReason: 'max_tokens' });
    expect(toCoachEvent({ event: 'done', data: '{}' })).toEqual({ type: 'done', stopReason: 'end_turn' });
  });

  it('reads an error, with a fallback message', () => {
    expect(toCoachEvent({ event: 'error', data: '{"message":"Overloaded"}' })).toEqual({ type: 'error', message: 'Overloaded' });
    expect(toCoachEvent({ event: 'error', data: '{}' })).toMatchObject({ type: 'error' });
  });

  it('ignores unknown events, bad JSON and deltas without text', () => {
    expect(toCoachEvent({ event: 'ping', data: '{}' })).toBeNull();
    expect(toCoachEvent({ event: 'delta', data: 'not json' })).toBeNull();
    expect(toCoachEvent({ event: 'delta', data: '"text"' })).toBeNull();
    expect(toCoachEvent({ event: 'delta', data: '{"text":42}' })).toBeNull();
  });
});
