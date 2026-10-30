import type { CoachQuestion } from '../../../engine/index.ts';
import type { CoachFailureNotice } from '../shared/coachErrors.ts';

/** Luka's fixed replies (CoachScript): no answer offline, coaching data switched off, the free plan used up. */
export type CoachNotice = 'unsupported' | 'coachingDataOff' | 'limitReached';

/** Where an AI answer is: still arriving, finished, cut off by its length limit, stopped by the user, or broken off. */
export type AiAnswerStatus = 'streaming' | 'complete' | 'cutShort' | 'stopped' | 'interrupted';

/**
 * What a message says. Scripted messages store intent, not text, so switching language re-renders them
 * (CoachView.swift); AI answers store the text Luka wrote.
 */
export type ChatContent =
  | { readonly kind: 'greeting' }
  /** A suggested question the user tapped. */
  | { readonly kind: 'question'; readonly question: CoachQuestion }
  | { readonly kind: 'userText'; readonly text: string }
  | { readonly kind: 'scriptedAnswer'; readonly question: CoachQuestion }
  /** `question` is the suggested question it answers, if it answers one. */
  | { readonly kind: 'aiAnswer'; readonly text: string; readonly status: AiAnswerStatus; readonly question: CoachQuestion | null }
  | { readonly kind: 'notice'; readonly notice: CoachNotice }
  | { readonly kind: 'failure'; readonly failure: CoachFailureNotice };

export type UserContent = Extract<ChatContent, { kind: 'question' | 'userText' }>;
/** Luka's replies that arrive in one piece. */
export type CoachReplyContent = Extract<ChatContent, { kind: 'scriptedAnswer' | 'notice' | 'failure' }>;

export interface ChatMessage {
  readonly id: number;
  readonly content: ChatContent;
}

export interface ConversationState {
  readonly messages: readonly ChatMessage[];
  readonly nextId: number;
  /** Waiting for Luka: the scripted pause, or an AI answer before its first words. */
  readonly isThinking: boolean;
  /** The AI answer being written, while it streams. */
  readonly streamingId: number | null;
}

/**
 * How a stream ended. 'discarded' drops the partial answer (a refusal); the others keep what arrived.
 * An answer that ended before any words arrived is always dropped.
 */
export type StreamOutcome = Exclude<AiAnswerStatus, 'streaming'> | 'discarded';

export type ConversationAction =
  /** The user asked something; Luka starts thinking. */
  | { readonly type: 'userAsked'; readonly content: UserContent }
  | { readonly type: 'replied'; readonly content: CoachReplyContent }
  | { readonly type: 'streamStarted'; readonly question: CoachQuestion | null }
  | { readonly type: 'streamDelta'; readonly text: string }
  /** Closes the AI answer; `followUp` is a reply that replaces or follows it (a fallback, an error). */
  | { readonly type: 'streamEnded'; readonly outcome: StreamOutcome; readonly followUp?: CoachReplyContent };

export function initialConversation(): ConversationState {
  return { messages: [{ id: 0, content: { kind: 'greeting' } }], nextId: 1, isThinking: false, streamingId: null };
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'userAsked':
      return { ...append(state, action.content), isThinking: true };
    case 'replied':
      return { ...append(state, action.content), isThinking: false };
    case 'streamStarted': {
      const next = append(state, { kind: 'aiAnswer', text: '', status: 'streaming', question: action.question });
      return { ...next, streamingId: state.nextId };
    }
    case 'streamDelta':
      if (state.streamingId === null || action.text === '') return state;
      return {
        ...updateAnswer(state, state.streamingId, (answer) => ({ ...answer, text: answer.text + action.text })),
        isThinking: false,
      };
    case 'streamEnded': {
      const closed = state.streamingId === null ? state : closeAnswer(state, state.streamingId, action.outcome);
      const settled: ConversationState = { ...closed, isThinking: false, streamingId: null };
      return action.followUp ? append(settled, action.followUp) : settled;
    }
  }
}

function append(state: ConversationState, content: ChatContent): ConversationState {
  return { ...state, messages: [...state.messages, { id: state.nextId, content }], nextId: state.nextId + 1 };
}

type AiAnswerContent = Extract<ChatContent, { kind: 'aiAnswer' }>;

function updateAnswer(state: ConversationState, id: number, change: (answer: AiAnswerContent) => AiAnswerContent): ConversationState {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === id && message.content.kind === 'aiAnswer' ? { ...message, content: change(message.content) } : message,
    ),
  };
}

function closeAnswer(state: ConversationState, id: number, outcome: StreamOutcome): ConversationState {
  const answer = state.messages.find((message) => message.id === id)?.content;
  const isEmpty = answer?.kind !== 'aiAnswer' || answer.text.trim() === '';
  if (outcome === 'discarded' || isEmpty) {
    return { ...state, messages: state.messages.filter((message) => message.id !== id) };
  }
  const status = outcome;
  return updateAnswer(state, id, (content) => ({ ...content, status }));
}

// Selectors

/** Busy while Luka thinks or writes: no new questions until he's done (CoachView's `isThinking`). */
export function isBusy(state: ConversationState): boolean {
  return state.isThinking || state.streamingId !== null;
}

/** The messages to draw: an AI answer appears with its first words; until then the typing indicator stands in. */
export function visibleMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages.filter(({ content }) => content.kind !== 'aiAnswer' || content.text.trim() !== '');
}

/** The hero shows until the conversation starts, like iOS (only the greeting so far). */
export function hasConversationStarted(state: ConversationState): boolean {
  return state.messages.length > 1;
}

/**
 * The suggested question Luka answered last, whose follow-ups the chips offer next; null before any.
 * Answers to free-form questions don't change the suggestions.
 */
export function lastAnsweredQuestion(messages: readonly ChatMessage[]): CoachQuestion | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const { content } = messages[index];
    if (content.kind === 'scriptedAnswer') return content.question;
    if (content.kind === 'aiAnswer' && content.question && (content.status === 'complete' || content.status === 'cutShort')) {
      return content.question;
    }
  }
  return null;
}
