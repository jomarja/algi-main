import type { BankConnectionStatus } from '../../shared/bank.ts';
import { HttpBankApi, isNotConnected } from './bank.ts';
import { ApiError } from './http.ts';

const fetchMock = vi.fn<typeof fetch>();
const api = new HttpBankApi();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpBankApi', () => {
  it('reads the connection status', async () => {
    const status: BankConnectionStatus = { connected: false, source: 'mock', consent: null, lastSyncedAt: null };
    fetchMock.mockResolvedValue(jsonResponse(status));

    await expect(api.status()).resolves.toEqual(status);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/bank/status');
  });

  it('starts a connection in the given language', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ authorizeUrl: 'https://tbc.test/authorize' }));

    await expect(api.connect('ka')).resolves.toEqual({ authorizeUrl: 'https://tbc.test/authorize' });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/bank/connect');
    expect(init).toMatchObject({ method: 'POST', body: '{"language":"ka"}' });
  });

  it('reads the cached snapshot by default', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accounts: [] }));
    await api.snapshot();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/bank/snapshot');
  });

  it('asks the server to re-read TBC on refresh', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accounts: [] }));
    await api.snapshot(true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/bank/snapshot?refresh=1');
  });

  it('rejects with not_connected when no bank is connected', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'not_connected', message: 'No bank is connected.' }, 401));
    const error = await api.snapshot().catch((caught: unknown) => caught);
    expect(isNotConnected(error)).toBe(true);
  });

  it('disconnects with DELETE and accepts an empty answer', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.disconnect()).resolves.toBeUndefined();
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/bank/connection');
    expect(init?.method).toBe('DELETE');
  });
});

describe('isNotConnected', () => {
  it('is false for other errors', () => {
    expect(isNotConnected(new ApiError('http', 'rate limited', { status: 503, code: 'bank_rate_limited' }))).toBe(false);
    expect(isNotConnected(new Error('not_connected'))).toBe(false);
  });
});
