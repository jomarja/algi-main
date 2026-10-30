import Anthropic from '@anthropic-ai/sdk';
import { type Server, createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BankSnapshot } from '../../shared/bank.ts';
import { loadConfig } from '../config.ts';
import type { BankDataSource } from '../contracts.ts';
import { HttpError, Router, Session, sendJson } from '../http.ts';
import { createCoachHandlers } from './handlers.ts';
import { registerCoachRoutes } from './routes.ts';
import {
  NOW,
  account,
  dataMessageOf,
  fakeClaude,
  reply,
  sampleAppContext,
  sampleSnapshot,
  textBlock,
  textDelta,
} from './test-fixtures.ts';

/** The coach's HTTP behaviour end to end, on a loopback server with Claude and the bank faked. */

const servers: Server[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((server) => {
    server.closeAllConnections();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  }));
});

/** Serves `router` like server/index.ts does, with one shared session. */
async function serve(router: Router): Promise<string> {
  const session = new Session('test-session');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    try {
      if (!(await router.handle({ req, res, url, session }))) sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      if (res.headersSent) res.end();
      else if (error instanceof HttpError) sendJson(res, error.status, { error: error.code, message: error.message });
      else sendJson(res, 500, { error: 'internal_error' });
    }
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

function fakeBank(...snapshots: Array<BankSnapshot | null>) {
  const snapshot = vi.fn<BankDataSource['snapshot']>();
  for (const value of snapshots) snapshot.mockResolvedValueOnce(value);
  return { snapshot };
}

async function serveCoach(claude: ReturnType<typeof fakeClaude>, bank: BankDataSource = fakeBank(sampleSnapshot())): Promise<string> {
  const router = new Router();
  const handlers = createCoachHandlers({ model: 'claude-opus-5-5', bank, claude, now: () => NOW });
  router.get('/api/coach/status', handlers.status);
  router.post('/api/coach/chat', handlers.chat);
  router.post('/api/coach/recommendations', handlers.recommendations);
  return serve(router);
}

const chatBody = (content = 'How much can I spend today?') => ({
  messages: [{ role: 'user', content }],
  context: sampleAppContext(),
});

const post = (url: string, body: unknown, signal?: AbortSignal) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });

/** Parses an SSE body into its events. */
function parseEvents(body: string): Array<{ event: string; data: unknown }> {
  return body
    .split('\n\n')
    .filter((frame) => frame.trim() !== '')
    .map((frame) => {
      const lines = frame.split('\n');
      const event = lines.find((line) => line.startsWith('event: '))?.slice('event: '.length) ?? '';
      const data: unknown = JSON.parse(lines.find((line) => line.startsWith('data: '))?.slice('data: '.length) ?? 'null');
      return { event, data };
    });
}

describe('without an API key', () => {
  async function serveWithoutKey(bank: BankDataSource): Promise<string> {
    const router = new Router();
    registerCoachRoutes(router, { config: loadConfig({ AI_MODEL: 'claude-opus-5-5' }), bank });
    return serve(router);
  }

  it('reports the coach as unavailable', async () => {
    const url = await serveWithoutKey(fakeBank());

    const response = await fetch(`${url}/api/coach/status`);

    expect(await response.json()).toEqual({ available: false, model: 'claude-opus-5-5' });
  });

  it.each(['chat', 'recommendations'])('answers %s with 503 ai_unavailable, without reading the bank', async (route) => {
    const bank = fakeBank(sampleSnapshot());
    const url = await serveWithoutKey(bank);

    const response = await post(`${url}/api/coach/${route}`, chatBody());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'ai_unavailable' });
    expect(bank.snapshot).not.toHaveBeenCalled();
  });
});

describe('with an API key', () => {
  it('reports the coach as available with the configured model', async () => {
    const router = new Router();
    registerCoachRoutes(router, { config: loadConfig({ ANTHROPIC_API_KEY: 'test-key', AI_MODEL: 'claude-opus-5-5' }), bank: fakeBank() });
    const url = await serve(router);

    const response = await fetch(`${url}/api/coach/status`);

    expect(await response.json()).toEqual({ available: true, model: 'claude-opus-5-5' });
  });
});

describe('POST /api/coach/chat', () => {
  it("streams Luka's reply as server-sent events", async () => {
    const claude = fakeClaude({ events: [textDelta('About '), textDelta('42.30 ₾ today.')] });
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/chat`, chatBody());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(parseEvents(await response.text())).toEqual([
      { event: 'delta', data: { text: 'About ' } },
      { event: 'delta', data: { text: '42.30 ₾ today.' } },
      { event: 'done', data: { stopReason: 'end_turn' } },
    ]);
  });

  it('sends the latest bank data with every message', async () => {
    const claude = fakeClaude({ events: [textDelta('OK')] });
    const bank = fakeBank(
      sampleSnapshot(),
      sampleSnapshot({ accounts: [account({ name: 'Everyday', balance: 980.25 })] }),
    );
    const url = await serveCoach(claude, bank);

    await (await post(`${url}/api/coach/chat`, chatBody())).text();
    await (await post(`${url}/api/coach/chat`, chatBody('And now?'))).text();

    expect(bank.snapshot).toHaveBeenCalledTimes(2);
    expect(dataMessageOf(claude.streamCalls[0].params)).toContain('balance 1,240.50 ₾');
    expect(dataMessageOf(claude.streamCalls[1].params)).toContain('balance 980.25 ₾');
    expect(dataMessageOf(claude.streamCalls[1].params)).toContain('Today: Friday, 2026-10-30');
  });

  it('still answers when the bank cannot be reached', async () => {
    const claude = fakeClaude({ events: [textDelta('OK')] });
    const bank = { snapshot: vi.fn<BankDataSource['snapshot']>().mockRejectedValue(new Error('TBC timeout')) };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const url = await serveCoach(claude, bank);

    const response = await post(`${url}/api/coach/chat`, chatBody());

    expect(parseEvents(await response.text()).at(-1)).toEqual({ event: 'done', data: { stopReason: 'end_turn' } });
    expect(dataMessageOf(claude.streamCalls[0].params)).toContain("Bank data couldn't be loaded");
  });

  it('rejects an invalid request before calling Claude', async () => {
    const claude = fakeClaude();
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/chat`, { messages: [], context: sampleAppContext() });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request', message: 'messages must not be empty' });
    expect(claude.streamCalls).toHaveLength(0);
  });

  it('reports a Claude failure as an error event', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const claude = fakeClaude({ error: new Anthropic.RateLimitError(429, { type: 'error' }, 'slow down', new Headers()) });
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/chat`, chatBody());

    expect(parseEvents(await response.text())).toEqual([{ event: 'error', data: { message: 'rate_limited' } }]);
  });

  it('ends with the refusal stop reason when every model declines', async () => {
    const claude = fakeClaude({ events: [textDelta('Partial')], stopReason: 'refusal' });
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/chat`, chatBody());

    expect(parseEvents(await response.text()).at(-1)).toEqual({ event: 'done', data: { stopReason: 'refusal' } });
  });

  it('aborts the Claude request when the browser disconnects', async () => {
    const claude = fakeClaude({ events: [textDelta('Thinking about it')], holdOpen: true });
    const url = await serveCoach(claude);
    const browser = new AbortController();

    const response = await post(`${url}/api/coach/chat`, chatBody(), browser.signal);
    const reader = response.body?.getReader();
    await reader?.read();
    browser.abort();

    await vi.waitFor(() => expect(claude.streamCalls[0].signal.aborted).toBe(true));
  });
});

describe('POST /api/coach/recommendations', () => {
  const suggestion = {
    title: 'You could free about 30 ₾ a month from food delivery.',
    detail: 'Delivery went up this month. One fewer order every week or two would cover it.',
    impactMonthly: 30,
    category: 'foodDelivery',
    action: 'review_budget',
    evidence: ['Food delivery this month: 147.10 ₾ (last month: 65.00 ₾)'],
    priority: 'medium',
  };

  it('returns validated recommendations with the model that wrote them', async () => {
    const claude = fakeClaude({ reply: reply([textBlock(JSON.stringify({ recommendations: [suggestion] }))], 'end_turn', 'claude-opus-4-8') });
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/recommendations`, { context: sampleAppContext() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recommendations: [{ id: 'rec-1', ...suggestion }],
      generatedAt: NOW.toISOString(),
      model: 'claude-opus-4-8',
    });
    expect(dataMessageOf(claude.createCalls[0].params)).toContain('- foodDelivery: this month 147.10 ₾ · last month 65.00 ₾');
  });

  it('answers 502 when every model declines', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const claude = fakeClaude({ reply: reply([], 'refusal') });
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/recommendations`, { context: sampleAppContext() });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: 'ai_refused' });
  });

  it('answers 503 when Claude cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const claude = fakeClaude({ error: new Anthropic.APIConnectionError({ message: 'socket hang up' }) });
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/recommendations`, { context: sampleAppContext() });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'ai_unavailable' });
  });

  it('rejects a request without a context', async () => {
    const claude = fakeClaude();
    const url = await serveCoach(claude);

    const response = await post(`${url}/api/coach/recommendations`, {});

    expect(response.status).toBe(400);
    expect(claude.createCalls).toHaveLength(0);
  });
});
