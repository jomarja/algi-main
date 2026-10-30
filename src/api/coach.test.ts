import type { CoachChatRequest, CoachRecommendationsRequest } from '../../shared/coach.ts';
import { HttpCoachApi } from './coach.ts';

const fetchMock = vi.fn<typeof fetch>();
const api = new HttpCoachApi();

const context: CoachRecommendationsRequest['context'] = {
  language: 'en',
  displayCurrency: 'GEL',
  userFirstName: 'Nino',
  objective: 'buildSavings',
  goals: [],
  summary: null,
  screen: '/coach',
};
const chatRequest: CoachChatRequest = { messages: [{ role: 'user', content: 'Hi' }], context };

/** A streamed answer delivered in the given chunks. */
function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpCoachApi.streamChat', () => {
  it('passes each delta on and resolves with the stop reason', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        'event: delta\ndata: {"text":"About "}\n\n',
        'event: delta\ndata: {"text":"323 ₾"}\n\nevent: do',
        'ne\ndata: {"stopReason":"end_turn"}\n\n',
      ]),
    );
    const deltas: string[] = [];

    await expect(api.streamChat(chatRequest, { onDelta: (text) => deltas.push(text) })).resolves.toEqual({ stopReason: 'end_turn' });
    expect(deltas).toEqual(['About ', '323 ₾']);
  });

  it('posts the request as JSON and asks for an event stream', async () => {
    fetchMock.mockResolvedValue(streamResponse(['event: done\ndata: {"stopReason":"end_turn"}\n\n']));
    await api.streamChat(chatRequest, { onDelta: () => undefined });

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/coach/chat');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(chatRequest), headers: { Accept: 'text/event-stream' } });
  });

  it('rejects with the message of an error event', async () => {
    fetchMock.mockResolvedValue(streamResponse(['event: delta\ndata: {"text":"Hm"}\n\nevent: error\ndata: {"message":"Overloaded"}\n\n']));
    await expect(api.streamChat(chatRequest, { onDelta: () => undefined })).rejects.toMatchObject({ kind: 'stream', code: 'Overloaded' });
  });

  it('rejects when the stream ends without done', async () => {
    fetchMock.mockResolvedValue(streamResponse(['event: delta\ndata: {"text":"Cut"}\n\n']));
    await expect(api.streamChat(chatRequest, { onDelta: () => undefined })).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('rejects an error status before streaming', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 }));
    await expect(api.streamChat(chatRequest, { onDelta: () => undefined })).rejects.toMatchObject({ kind: 'http', code: 'invalid_request' });
  });

  it('reports a cancellation while reading', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_path, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          init?.signal?.addEventListener('abort', () => stream.error(new DOMException('Aborted', 'AbortError')));
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    const pending = api.streamChat(chatRequest, { onDelta: () => undefined, signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  });
});

describe('HttpCoachApi', () => {
  it('reads the coach status', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ available: true, model: 'claude' }), { status: 200 }));
    await expect(api.status()).resolves.toEqual({ available: true, model: 'claude' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/coach/status');
  });

  it('posts for recommendations', async () => {
    const answer = { recommendations: [], generatedAt: '2026-10-30T10:00:00Z', model: 'claude' };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(answer), { status: 200 }));

    await expect(api.recommendations({ context })).resolves.toEqual(answer);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/coach/recommendations');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ context }) });
  });
});
