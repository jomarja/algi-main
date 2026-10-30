import type Anthropic from '@anthropic-ai/sdk';
import type { CoachRecommendation } from '../../shared/coach.ts';
import { HttpError } from '../http.ts';
import { type ClaudeReply, cachedText, dataMessage, sharedParams } from './claude.ts';
import { clip } from './format.ts';
import { isArray, isOneOf, isRecord } from './json.ts';
import { LUKA_SYSTEM_PROMPT, RECOMMENDATIONS_PROMPT, RECOMMENDATIONS_REQUEST } from './prompts.ts';
import { COACH_ACTIONS, PRIORITIES, SPENDING_CATEGORY_IDS } from './vocabulary.ts';

/**
 * Luka's suggestions, generated with structured outputs. `medium` effort: this is analysis across the
 * whole data block, and it isn't streamed to someone waiting on each word.
 */
const RECOMMENDATIONS_EFFORT = 'medium';
/** The non-streaming ceiling that stays well inside the SDK's request timeout. */
const RECOMMENDATIONS_MAX_TOKENS = 16_000;

const limits = { recommendations: 5, title: 120, detail: 400, evidenceItems: 3, evidence: 200 };

/**
 * Structured-output schema for the model's answer. Ids are assigned by the server, and counts and
 * lengths are checked after parsing, since structured outputs don't support those constraints.
 */
export const RECOMMENDATIONS_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          impactMonthly: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          category: { anyOf: [{ type: 'string', enum: SPENDING_CATEGORY_IDS }, { type: 'null' }] },
          action: { type: 'string', enum: COACH_ACTIONS },
          evidence: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: PRIORITIES },
        },
        required: ['title', 'detail', 'impactMonthly', 'category', 'action', 'evidence', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};

export function buildRecommendationsParams(model: string, coachData: string): Anthropic.Beta.MessageCreateParamsNonStreaming {
  return {
    ...sharedParams(model),
    max_tokens: RECOMMENDATIONS_MAX_TOKENS,
    output_config: {
      effort: RECOMMENDATIONS_EFFORT,
      format: { type: 'json_schema', schema: RECOMMENDATIONS_SCHEMA },
    },
    // The first block is the chat's system prompt, byte for byte, so both routes share one rule set.
    system: [cachedText(LUKA_SYSTEM_PROMPT), cachedText(RECOMMENDATIONS_PROMPT)],
    messages: [{ role: 'user', content: [{ type: 'text', text: RECOMMENDATIONS_REQUEST }] }, dataMessage(coachData)],
  };
}

/** Turns Claude's reply into recommendations the app can show, or a 502 the app falls back from. */
export function parseRecommendations(reply: ClaudeReply): CoachRecommendation[] {
  if (reply.stop_reason === 'refusal') throw new HttpError(502, 'ai_refused', 'Every model declined to write recommendations');
  if (reply.stop_reason !== 'end_turn') throw new HttpError(502, 'ai_error', `Recommendations stopped early (${reply.stop_reason})`);
  const text = reply.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new HttpError(502, 'ai_error', 'Recommendations were not valid JSON');
  }
  const recommendations = validateRecommendations(payload);
  if (recommendations.length === 0) throw new HttpError(502, 'ai_error', 'No usable recommendations');
  return recommendations;
}

/**
 * Keeps the items that satisfy the contract (at most five, in the model's order) and gives them ids.
 * An item is dropped, not repaired, when a field is wrong or its evidence quotes no figure.
 */
export function validateRecommendations(payload: unknown): CoachRecommendation[] {
  const items = isRecord(payload) && isArray(payload.recommendations) ? payload.recommendations : [];
  return items
    .map(toRecommendation)
    .filter((item): item is Omit<CoachRecommendation, 'id'> => item !== null)
    .slice(0, limits.recommendations)
    .map((item, index) => ({ id: `rec-${index + 1}`, ...item }));
}

function toRecommendation(value: unknown): Omit<CoachRecommendation, 'id'> | null {
  if (!isRecord(value)) return null;
  const title = readText(value.title, limits.title);
  const detail = readText(value.detail, limits.detail);
  const evidence = readEvidence(value.evidence);
  const impactMonthly = value.impactMonthly === null ? null : readAmount(value.impactMonthly);
  const category = value.category === null ? null : readOneOf(value.category, SPENDING_CATEGORY_IDS);
  const action = readOneOf(value.action, COACH_ACTIONS);
  const priority = readOneOf(value.priority, PRIORITIES);
  if (!title || !detail || !evidence || impactMonthly === undefined || category === undefined || !action || !priority) return null;
  return { title, detail, impactMonthly, category, action, evidence, priority };
}

// Readers return undefined for an invalid value; null stays a valid "not applicable".

function readText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? clip(text, maxLength) : undefined;
}

function readAmount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

function readOneOf<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return isOneOf(value, options) ? value : undefined;
}

/** One to three facts, at least one of them quoting a figure from the user's data. */
function readEvidence(value: unknown): string[] | undefined {
  if (!isArray(value)) return undefined;
  const facts = value
    .map((fact) => readText(fact, limits.evidence))
    .filter((fact): fact is string => fact !== undefined)
    .slice(0, limits.evidenceItems);
  return facts.some((fact) => /\d/.test(fact)) ? facts : undefined;
}
