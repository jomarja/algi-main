import type { ServerConfig } from '../config.ts';
import type { BankDataSource } from '../contracts.ts';
import type { Router } from '../http.ts';
import { createClaudeMessages } from './claude.ts';
import { createCoachHandlers } from './handlers.ts';

/**
 * Luka, the AI coach (contract in shared/coach.ts):
 *   GET  /api/coach/status           -> CoachStatus
 *   POST /api/coach/chat             -> Server-Sent Events (delta / done / error)
 *   POST /api/coach/recommendations  -> CoachRecommendationsResponse
 * Without ANTHROPIC_API_KEY the coach reports itself unavailable and the app uses Luka's built-in script.
 */
export function registerCoachRoutes(router: Router, deps: { config: ServerConfig; bank: BankDataSource }): void {
  const { apiKey, model } = deps.config.ai;
  const handlers = createCoachHandlers({
    model,
    bank: deps.bank,
    claude: apiKey ? createClaudeMessages(apiKey) : null,
  });
  router.get('/api/coach/status', handlers.status);
  router.post('/api/coach/chat', handlers.chat);
  router.post('/api/coach/recommendations', handlers.recommendations);
}
