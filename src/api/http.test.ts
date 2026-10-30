import { ApiError, isApiError, requestJson, send } from './http.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('send', () => {
  it('sends same-origin requests with JSON headers and body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await send('/api/bank/connect', { method: 'POST', body: { language: 'ka' } });

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/bank/connect');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      body: '{"language":"ka"}',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  });

  it('sends GET without a body or content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await send('/api/bank/status');

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toEqual({ Accept: 'application/json' });
  });

  it('turns an error answer into an ApiError with the server code and message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'not_connected', message: 'No bank is connected.' }, 401));

    const error = await send('/api/bank/snapshot').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status: 401, code: 'not_connected', message: 'No bank is connected.' });
  });

  it('falls back to the status when the error answer is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(send('/api/bank/status')).rejects.toMatchObject({ kind: 'http', status: 502, code: 'http_502' });
  });

  it('reports a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(send('/api/coach/status')).rejects.toMatchObject({ kind: 'network', status: 0, code: 'network' });
  });

  it('times out when no answer arrives in time', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_path, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const pending = send('/api/bank/snapshot', { timeoutMs: 1000 });
    vi.advanceTimersByTime(1000);
    await expect(pending).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('reports a cancellation by the caller', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_path, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const pending = send('/api/coach/chat', { method: 'POST', signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('does not start a request the caller already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockImplementation((_path, init) =>
      init?.signal?.aborted ? Promise.reject(new DOMException('Aborted', 'AbortError')) : Promise.resolve(jsonResponse({})),
    );
    await expect(send('/api/coach/chat', { signal: controller.signal })).rejects.toMatchObject({ kind: 'aborted' });
  });
});

describe('requestJson', () => {
  it('parses the JSON answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ connected: true }));
    await expect(requestJson('/api/bank/status')).resolves.toEqual({ connected: true });
  });

  it('rejects an answer that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('hello', { status: 200 }));
    await expect(requestJson('/api/bank/status')).rejects.toMatchObject({ kind: 'invalid_response', status: 200 });
  });
});

describe('isApiError', () => {
  it('recognises only ApiError', () => {
    expect(isApiError(new ApiError('network', 'offline'))).toBe(true);
    expect(isApiError(new Error('offline'))).toBe(false);
  });

  it('defaults the code to the kind', () => {
    expect(new ApiError('timeout', 'slow')).toMatchObject({ code: 'timeout', status: 0, name: 'ApiError' });
  });
});
