import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CoachChatRequest } from '../../../../shared/coach.ts';
import { APP_LANGUAGES, coachSuggestions, createDisplay, type CoachQuestion, type CoachScript } from '../../../engine/index.ts';
import type { AppStore } from '../../../state/appStore.ts';
import { aiAvailability, coachApi } from '../shared/coachApi.ts';
import { classifyCoachError, isFailureNotice } from '../shared/coachErrors.ts';
import {
  conversationReducer,
  initialConversation,
  isBusy,
  lastAnsweredQuestion,
  type ConversationAction,
  type ConversationState,
  type StreamOutcome,
} from './conversation.ts';
import { createDeltaBuffer } from './deltaBuffer.ts';
import { chatRequestMessages, type ScriptTexts } from './history.ts';
import { MAX_MESSAGE_CHARS } from './messageLimit.ts';
import { personalizationBlock, scriptedPrompts, scriptedReply, type Personalization, type Prompt, type Reply } from './scriptedReply.ts';

/** Luka "thinks" this long before a scripted reply, as on iOS. */
const SCRIPTED_REPLY_DELAY_MS = 1_100;
const COACH_SCREEN = '/coach';

/**
 * The conversation outlives the screen for the rest of the session, so switching tabs doesn't lose it.
 * It stays in memory only: it holds the user's figures, so it is never written to storage.
 */
let sessionConversation: ConversationState | null = null;

/** The saved conversation, with anything left half-way (the screen closed mid-answer) settled as stopped. */
function restoreConversation(): ConversationState {
  if (!sessionConversation) return initialConversation();
  return isBusy(sessionConversation) ? conversationReducer(sessionConversation, { type: 'streamEnded', outcome: 'stopped' }) : sessionConversation;
}

interface PendingReply extends Reply {
  readonly timer: number;
}

export interface CoachChat {
  readonly state: ConversationState;
  /** Suggested questions: follow-ups to the last answered one, or all of them to start with. */
  readonly suggestions: readonly CoachQuestion[];
  readonly isBusy: boolean;
  /** An AI answer is on its way: it can be stopped. */
  readonly isStreaming: boolean;
  ask(question: CoachQuestion): void;
  /** Sends a typed question; false when there is nothing to send or Luka is still answering. */
  send(text: string): boolean;
  stop(): void;
}

function scriptTexts(script: CoachScript): ScriptTexts {
  return { prompt: (question) => script.prompt(question), answer: (question) => script.reply(question).text };
}

function personalizationOf(store: AppStore): Personalization {
  return { usesTransactions: store.getState().permissions.useTransactionsForCoaching, hasAnswersLeft: store.canUsePersonalizedAI };
}

/** Luka's scripted reply, matching a typed question against the suggested ones in both languages. */
function scriptedReplyFor(store: AppStore, prompt: Prompt): Reply {
  const { displayCurrency } = store.getState();
  const scripts = APP_LANGUAGES.map((language) => store.coachScript(createDisplay(language, displayCurrency, store.converter)));
  return scriptedReply(prompt, personalizationOf(store), scriptedPrompts(scripts));
}

/**
 * The AI coach chat (CoachView.swift). With the AI available, every question — typed or suggested — streams
 * from POST /api/coach/chat, so Luka keeps one voice and the whole conversation as context. Offline, after a
 * refusal, or when the AI can't be reached, the deterministic CoachScript answers instead.
 */
export function useCoachChat(store: AppStore, script: CoachScript): CoachChat {
  const [state, setState] = useState(restoreConversation);
  const stateRef = useRef(state);
  const scriptRef = useRef(script);
  useLayoutEffect(() => {
    scriptRef.current = script;
  });
  const abortRef = useRef<AbortController | null>(null);
  const pendingReply = useRef<PendingReply | null>(null);
  const isMounted = useRef(false);

  /** Updates synchronously, so async steps always build on the latest conversation, even after unmounting. */
  const dispatch = useCallback((action: ConversationAction) => {
    stateRef.current = conversationReducer(stateRef.current, action);
    sessionConversation = stateRef.current;
    setState(stateRef.current);
  }, []);

  const deliver = useCallback(
    (reply: Reply) => {
      dispatch({ type: 'replied', content: reply.content });
      if (reply.isPersonalized) store.recordPersonalizedAIAnswer();
    },
    [dispatch, store],
  );

  const deliverAfterThinking = useCallback(
    (reply: Reply) => {
      const timer = window.setTimeout(() => {
        pendingReply.current = null;
        deliver(reply);
      }, SCRIPTED_REPLY_DELAY_MS);
      pendingReply.current = { ...reply, timer };
    },
    [deliver],
  );

  /** Closes the AI answer and lets the script answer instead. */
  const endWithScriptedReply = useCallback(
    (outcome: StreamOutcome, prompt: Prompt) => {
      const reply = scriptedReplyFor(store, prompt);
      dispatch({ type: 'streamEnded', outcome, followUp: reply.content });
      if (reply.isPersonalized) store.recordPersonalizedAIAnswer();
    },
    [dispatch, store],
  );

  const streamAnswer = useCallback(
    async (prompt: Prompt) => {
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: 'streamStarted', question: prompt.question });
      let hasWords = false;
      const buffer = createDeltaBuffer((text) => {
        hasWords ||= text.trim() !== '';
        dispatch({ type: 'streamDelta', text });
      });
      const request: CoachChatRequest = {
        messages: chatRequestMessages(stateRef.current.messages, scriptTexts(scriptRef.current)),
        context: store.coachContext(COACH_SCREEN),
      };

      try {
        const { stopReason } = await coachApi.streamChat(request, { onDelta: buffer.push, signal: controller.signal });
        buffer.flush();
        if (stopReason === 'refusal') {
          // Every model declined: what arrived is discarded and the script answers.
          endWithScriptedReply('discarded', prompt);
        } else if (!hasWords) {
          dispatch({ type: 'streamEnded', outcome: 'complete', followUp: { kind: 'failure', failure: 'aiError' } });
        } else {
          dispatch({ type: 'streamEnded', outcome: stopReason === 'max_tokens' ? 'cutShort' : 'complete' });
          store.recordPersonalizedAIAnswer();
        }
      } catch (error) {
        buffer.flush();
        const failure = classifyCoachError(error);
        if (failure === 'offline') {
          aiAvailability.markOffline();
          endWithScriptedReply('interrupted', prompt);
        } else if (isFailureNotice(failure)) {
          dispatch({ type: 'streamEnded', outcome: 'interrupted', followUp: { kind: 'failure', failure } });
        } else {
          dispatch({ type: 'streamEnded', outcome: 'stopped' });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [dispatch, endWithScriptedReply, store],
  );

  const respond = useCallback(
    async (prompt: Prompt) => {
      const isOnline = await aiAvailability.resolve();
      if (!isMounted.current) {
        // The screen closed while checking: don't start an answer nobody will see.
        dispatch({ type: 'streamEnded', outcome: 'stopped' });
        return;
      }
      if (!isOnline) {
        deliverAfterThinking(scriptedReplyFor(store, prompt));
        return;
      }
      const block = personalizationBlock(personalizationOf(store));
      if (block) {
        deliverAfterThinking({ content: block, isPersonalized: false });
        return;
      }
      await streamAnswer(prompt);
    },
    [deliverAfterThinking, dispatch, store, streamAnswer],
  );

  const ask = useCallback(
    (question: CoachQuestion) => {
      if (isBusy(stateRef.current)) return;
      dispatch({ type: 'userAsked', content: { kind: 'question', question } });
      void respond({ question, text: scriptRef.current.prompt(question) });
    },
    [dispatch, respond],
  );

  const send = useCallback(
    (draft: string): boolean => {
      const text = draft.trim();
      if (text === '' || text.length > MAX_MESSAGE_CHARS || isBusy(stateRef.current)) return false;
      dispatch({ type: 'userAsked', content: { kind: 'userText', text } });
      void respond({ question: null, text });
      return true;
    },
    [dispatch, respond],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Leaving the screen stops an answer in progress (the server stops Claude too) and delivers a scripted
  // reply that was still "thinking", so the saved conversation is never left half-way.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortRef.current?.abort();
      const reply = pendingReply.current;
      if (!reply) return;
      window.clearTimeout(reply.timer);
      pendingReply.current = null;
      deliver(reply);
    };
  }, [deliver]);

  // A question asked from another screen (store.askCoach) is answered when the coach opens. The timer lets
  // React's development double-mount settle before the question is taken.
  const { pendingCoachQuestion } = store.getState();
  useEffect(() => {
    if (!pendingCoachQuestion) return;
    const timer = window.setTimeout(() => {
      store.clearPendingCoachQuestion();
      ask(pendingCoachQuestion);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingCoachQuestion, store, ask]);

  const lastQuestion = lastAnsweredQuestion(state.messages);
  const suggestions = useMemo(() => coachSuggestions(lastQuestion, script), [lastQuestion, script]);

  return {
    state,
    suggestions,
    isBusy: isBusy(state),
    isStreaming: state.streamingId !== null,
    ask,
    send,
    stop,
  };
}
