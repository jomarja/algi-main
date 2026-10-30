import { createServer } from 'node:http';
import { HttpError, Router, SessionStore, sendJson } from './http.ts';
import { loadConfig, tbcConfigProblems } from './config.ts';
import { serveStatic } from './static.ts';
import { createBankService, registerBankRoutes } from './openbanking/routes.ts';
import { registerMockTbcRoutes } from './mock-tbc/routes.ts';
import { registerCoachRoutes } from './ai/routes.ts';

/**
 * Algi's server: TBC Open Banking (or its built-in mock), the AI coach, and the built front end.
 * Start with `npm run start` (production) or `npm run dev:server` next to `npm run dev` (development).
 */

const config = loadConfig();
const sessions = new SessionStore(config.publicBaseUrl.startsWith('https://'));
const router = new Router();

const bank = createBankService(config);
registerBankRoutes(router, bank);
registerCoachRoutes(router, { config, bank });
if (config.tbc.mode === 'mock') registerMockTbcRoutes(router, config);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', config.internalBaseUrl);
  try {
    const session = sessions.resolve(req, res);
    if (await router.handle({ req, res, url, session })) return;
    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    if (config.production && (await serveStatic(req, res, url, config.staticDir))) return;
    sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.code, message: error.message });
      return;
    }
    console.error(`[server] ${req.method} ${url.pathname} failed`, error);
    sendJson(res, 500, { error: 'internal_error' });
  }
});

server.listen(config.port, () => {
  console.log(`[server] Algi listening on ${config.internalBaseUrl} (public ${config.publicBaseUrl})`);
  console.log(`[server] bank data: TBC ${config.tbc.mode}${config.tbc.mode === 'mock' ? ' (built-in mock of TBC Open Banking)' : ''}`);
  for (const problem of tbcConfigProblems(config.tbc)) console.warn(`[server] TBC: ${problem}`);
  console.log(`[server] AI coach: ${config.ai.apiKey ? config.ai.model : 'off (set ANTHROPIC_API_KEY)'}`);
});
