import type { ServerResponse } from 'node:http';
import type { CoachAppContext, CoachRecommendationsResponse, CoachStatus } from '../../shared/coach.ts';
import type { BankDataSource } from '../contracts.ts';
import { type Handler, type Session, readJson, sendJson } from '../http.ts';
import { buildChatParams, streamChatReply } from './chat.ts';
import { type ClaudeMessages, logClaudeFailure, toHttpError } from './claude.ts';
import { type BankData, buildCoachData } from './context.ts';
import { buildRecommendationsParams, parseRecommendations } from './recommendations.ts';
import { openEventStream, writeEvent } from './sse.ts';
import { parseChatRequest, parseRecommendationsRequest } from './validation.ts';

export interface CoachHandlerDeps {
  model: string;
  bank: BankDataSource;
  /** Null when no API key is configured: the app then uses Luka's built-in script. */
  claude: ClaudeMessages | null;
  now?: () => Date;
}

export interface CoachHandlers {
  status: Handler;
  chat: Handler;
  recommendations: Handler;
}

export function createCoachHandlers(deps: CoachHandlerDeps): CoachHandlers {
  const now = deps.now ?? (() => new Date());

  /** Reads the bank on every request, so Luka always sees the latest balances and transactions. */
  async function coachDataFor(context: CoachAppContext, session: Session): Promise<string> {
    return buildCoachData(await readBankData(deps.bank, session), context, now());
  }

  return {
    status: ({ res }) => {
      sendJson(res, 200, { available: deps.claude !== null, model: deps.model } satisfies CoachStatus);
    },

    chat: async ({ req, res, session }) => {
      const { claude } = deps;
      if (!claude) return sendUnavailable(res);
      const { messages, context } = parseChatRequest(await readJson<unknown>(req));
      const signal = abortWhenClientLeaves(res);
      const params = buildChatParams(deps.model, messages, await coachDataFor(context, session));

      openEventStream(res);
      try {
        const stopReason = await streamChatReply(claude, params, signal, (text) => writeEvent(res, { type: 'delta', text }));
        writeEvent(res, { type: 'done', stopReason });
      } catch (error) {
        if (signal.aborted) return;
        logClaudeFailure('chat', error);
        writeEvent(res, { type: 'error', message: toHttpError(error).code });
      } finally {
        res.end();
      }
    },

    recommendations: async ({ req, res, session }) => {
      const { claude } = deps;
      if (!claude) return sendUnavailable(res);
      const { context } = parseRecommendationsRequest(await readJson<unknown>(req));
      const signal = abortWhenClientLeaves(res);
      const params = buildRecommendationsParams(deps.model, await coachDataFor(context, session));

      try {
        const reply = await claude.create(params, { signal });
        const response: CoachRecommendationsResponse = {
          recommendations: parseRecommendations(reply),
          generatedAt: now().toISOString(),
          model: reply.model,
        };
        sendJson(res, 200, response);
      } catch (error) {
        if (signal.aborted) return;
        logClaudeFailure('recommendations', error);
        throw toHttpError(error);
      }
    },
  };
}

async function readBankData(bank: BankDataSource, session: Session): Promise<BankData> {
  try {
    const snapshot = await bank.snapshot(session);
    return snapshot ? { status: 'connected', snapshot } : { status: 'not_connected' };
  } catch (error) {
    // Luka can still help with goals and the app's plan; the data block tells him bank data is missing.
    console.warn('[coach] bank data unavailable', error);
    return { status: 'unavailable' };
  }
}

/** Aborts the Claude request when the browser goes away, so an abandoned answer stops costing tokens. */
function abortWhenClientLeaves(res: ServerResponse): AbortSignal {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

function sendUnavailable(res: ServerResponse): void {
  sendJson(res, 503, { error: 'ai_unavailable' });
}
