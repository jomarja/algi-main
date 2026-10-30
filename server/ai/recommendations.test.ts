import { describe, expect, it } from 'vitest';
import { HttpError } from '../http.ts';
import { isArray, isRecord } from './json.ts';
import { LUKA_SYSTEM_PROMPT, RECOMMENDATIONS_PROMPT, RECOMMENDATIONS_REQUEST, coachDataMessage } from './prompts.ts';
import {
  RECOMMENDATIONS_SCHEMA,
  buildRecommendationsParams,
  parseRecommendations,
  validateRecommendations,
} from './recommendations.ts';
import { reply, textBlock } from './test-fixtures.ts';

const recommendation = (overrides: Record<string, unknown> = {}) => ({
  title: 'You could free about 30 ₾ a month from food delivery.',
  detail: 'Delivery went up this month. One fewer order every week or two would cover it.',
  impactMonthly: 30,
  category: 'foodDelivery',
  action: 'review_budget',
  evidence: ['Food delivery this month: 147.10 ₾ (last month: 65.00 ₾)'],
  priority: 'medium',
  ...overrides,
});

const json = (recommendations: unknown[]) => JSON.stringify({ recommendations });

function rejection(run: () => unknown): HttpError {
  try {
    run();
  } catch (error) {
    if (error instanceof HttpError) return error;
    throw error;
  }
  throw new Error('expected an HttpError');
}

describe('RECOMMENDATIONS_SCHEMA', () => {
  /** Structured outputs require every object to be closed and to list all of its properties as required. */
  function expectStrictObjects(schema: unknown): void {
    if (isArray(schema)) {
      schema.forEach(expectStrictObjects);
      return;
    }
    if (!isRecord(schema)) return;
    if (schema.type === 'object') {
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(isRecord(schema.properties) ? Object.keys(schema.properties) : []);
    }
    Object.values(schema).forEach(expectStrictObjects);
  }

  it('is a strict schema structured outputs accept', () => {
    expectStrictObjects(RECOMMENDATIONS_SCHEMA);
  });

  it('avoids constraints structured outputs do not support', () => {
    const text = JSON.stringify(RECOMMENDATIONS_SCHEMA);
    for (const keyword of ['minItems', 'maxItems', 'minLength', 'maxLength', 'minimum', 'maximum']) {
      expect(text).not.toContain(`"${keyword}"`);
    }
  });
});

describe('buildRecommendationsParams', () => {
  const params = buildRecommendationsParams('claude-opus-5-5', 'DATA');

  it('asks for JSON in the schema at medium effort, with the refusal fallback', () => {
    expect(params.output_config).toEqual({ effort: 'medium', format: { type: 'json_schema', schema: RECOMMENDATIONS_SCHEMA } });
    expect(params.thinking).toEqual({ type: 'adaptive' });
    expect(params.fallbacks).toBe('default');
    expect(params.model).toBe('claude-opus-5-5');
  });

  it("reuses the chat's cached system prompt and adds the task after it", () => {
    expect(params.system).toEqual([
      { type: 'text', text: LUKA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: RECOMMENDATIONS_PROMPT, cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('sends a fixed request followed by the data', () => {
    expect(params.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: RECOMMENDATIONS_REQUEST }] },
      { role: 'system', content: coachDataMessage('DATA') },
    ]);
  });
});

describe('validateRecommendations', () => {
  it('keeps valid items and numbers them', () => {
    const result = validateRecommendations({ recommendations: [recommendation(), recommendation({ category: null, impactMonthly: null, action: 'none', priority: 'low' })] });

    expect(result).toEqual([
      { id: 'rec-1', ...recommendation() },
      { id: 'rec-2', ...recommendation({ category: null, impactMonthly: null, action: 'none', priority: 'low' }) },
    ]);
  });

  it.each([
    ['an empty title', { title: '  ' }],
    ['a missing detail', { detail: undefined }],
    ['an unknown action', { action: 'buy_crypto' }],
    ['an unknown category', { category: 'gambling' }],
    ['an unknown priority', { priority: 'urgent' }],
    ['a negative impact', { impactMonthly: -20 }],
    ['an impact that is not a number', { impactMonthly: '30' }],
    ['no evidence', { evidence: [] }],
    ['evidence without a figure', { evidence: ['You order a lot of food'] }],
    ['evidence that is not a list', { evidence: 'Food delivery: 147.10 ₾' }],
  ])('drops an item with %s', (_case, overrides) => {
    const result = validateRecommendations({ recommendations: [recommendation(overrides), recommendation({ title: 'Kept' })] });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'rec-1', title: 'Kept' });
  });

  it('keeps at most five, in the order given', () => {
    const items = Array.from({ length: 7 }, (_, index) => recommendation({ title: `Suggestion ${index + 1}` }));
    const result = validateRecommendations({ recommendations: items });

    expect(result.map((item) => item.title)).toEqual(['Suggestion 1', 'Suggestion 2', 'Suggestion 3', 'Suggestion 4', 'Suggestion 5']);
  });

  it('tidies whitespace, clips long text and keeps up to three facts', () => {
    const result = validateRecommendations({
      recommendations: [
        recommendation({
          title: `  Delivery\n is up  ${'x'.repeat(200)}`,
          evidence: ['a 1', 'b 2', 'c 3', 'd 4'],
          impactMonthly: 29.999,
        }),
      ],
    });

    expect(result[0].title.startsWith('Delivery is up x')).toBe(true);
    expect(Array.from(result[0].title)).toHaveLength(120);
    expect(result[0].evidence).toEqual(['a 1', 'b 2', 'c 3']);
    expect(result[0].impactMonthly).toBe(30);
  });

  it('returns nothing for a payload of the wrong shape', () => {
    expect(validateRecommendations([])).toEqual([]);
    expect(validateRecommendations({ recommendations: 'none' })).toEqual([]);
  });
});

describe('parseRecommendations', () => {
  it('parses the JSON text', () => {
    const result = parseRecommendations(reply([textBlock(json([recommendation()]))]));
    expect(result).toEqual([{ id: 'rec-1', ...recommendation() }]);
  });

  it('joins JSON split across text blocks', () => {
    const text = json([recommendation()]);
    const result = parseRecommendations(reply([textBlock(text.slice(0, 20)), textBlock(text.slice(20))]));
    expect(result).toHaveLength(1);
  });

  it('reports a refusal by every model', () => {
    const error = rejection(() => parseRecommendations(reply([], 'refusal')));
    expect(error.status).toBe(502);
    expect(error.code).toBe('ai_refused');
  });

  it('rejects an answer that was cut short', () => {
    expect(rejection(() => parseRecommendations(reply([textBlock('{"recommendations": [')], 'max_tokens'))).code).toBe('ai_error');
  });

  it('rejects text that is not JSON', () => {
    expect(rejection(() => parseRecommendations(reply([textBlock('Here are some tips!')]))).message).toBe('Recommendations were not valid JSON');
  });

  it('rejects an answer with no usable recommendation', () => {
    expect(rejection(() => parseRecommendations(reply([textBlock(json([recommendation({ evidence: [] })]))]))).message).toBe('No usable recommendations');
  });
});
