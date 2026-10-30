import { COACH_QUESTIONS, type CoachQuestion, type CoachScript } from '../../../engine/index.ts';
import type { CoachReplyContent } from './conversation.ts';
import { matchScriptedQuestion, type ScriptedPrompt } from './scriptMatching.ts';

/** What the user asked: the suggested question it is, if it is one, and its words. */
export interface Prompt {
  readonly question: CoachQuestion | null;
  readonly text: string;
}

/** A reply and whether it counts as one of the month's personalised answers. */
export interface Reply {
  readonly content: CoachReplyContent;
  readonly isPersonalized: boolean;
}

/** The user's choices that decide whether Luka may give a personalised answer. */
export interface Personalization {
  /** Profile → Data-sharing permissions: "Use my transactions for coaching". */
  readonly usesTransactions: boolean;
  /** Premium, or free answers left this month. */
  readonly hasAnswersLeft: boolean;
}

/** Why Luka can't give a personalised answer right now (iOS CoachView.ask), or null when he can. */
export function personalizationBlock(personalization: Personalization): CoachReplyContent | null {
  if (!personalization.usesTransactions) return { kind: 'notice', notice: 'coachingDataOff' };
  if (!personalization.hasAnswersLeft) return { kind: 'notice', notice: 'limitReached' };
  return null;
}

/**
 * Luka's scripted reply: the script's answer to a suggested question, or to a typed one that matches a suggested
 * question word for word, within the same limits as iOS; anything else gets the "can't answer that" reply.
 */
export function scriptedReply(prompt: Prompt, personalization: Personalization, prompts: readonly ScriptedPrompt[]): Reply {
  const question = prompt.question ?? matchScriptedQuestion(prompt.text, prompts);
  if (!question) return { content: { kind: 'notice', notice: 'unsupported' }, isPersonalized: false };
  const block = personalizationBlock(personalization);
  if (block) return { content: block, isPersonalized: false };
  return { content: { kind: 'scriptedAnswer', question }, isPersonalized: true };
}

/** Every suggested question as each script words it, e.g. one script per language. */
export function scriptedPrompts(scripts: readonly CoachScript[]): ScriptedPrompt[] {
  return COACH_QUESTIONS.map((question) => ({ question, texts: scripts.map((script) => script.prompt(question)) }));
}
