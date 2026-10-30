import type { CoachQuestion } from '../../../engine/index.ts';

/** A suggested question and the ways it is written (its prompt in each language). */
export interface ScriptedPrompt {
  readonly question: CoachQuestion;
  readonly texts: readonly string[];
}

/** Lower case, without punctuation, symbols or extra spaces, so "How much can I spend this week?" matches typed variants. */
export function normalizeQuestion(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The suggested question a typed message asks, when it is one of them word for word in either language,
 * so Luka's script can still answer it offline. Anything looser could answer a different question with
 * real figures, so other messages get the offline reply instead.
 */
export function matchScriptedQuestion(text: string, prompts: readonly ScriptedPrompt[]): CoachQuestion | null {
  const typed = normalizeQuestion(text);
  if (typed === '') return null;
  return prompts.find((prompt) => prompt.texts.some((candidate) => normalizeQuestion(candidate) === typed))?.question ?? null;
}
