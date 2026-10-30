import {
  conversationReducer,
  hasConversationStarted,
  initialConversation,
  isBusy,
  lastAnsweredQuestion,
  visibleMessages,
  type ChatContent,
  type ConversationAction,
  type ConversationState,
} from './conversation.ts';

function run(...actions: ConversationAction[]): ConversationState {
  return actions.reduce(conversationReducer, initialConversation());
}

function contents(state: ConversationState): ChatContent[] {
  return state.messages.map((message) => message.content);
}

const askText: ConversationAction = { type: 'userAsked', content: { kind: 'userText', text: 'Can I afford a trip?' } };

describe('conversationReducer', () => {
  it('starts with Luka greeting and nothing in progress', () => {
    const state = initialConversation();
    expect(contents(state)).toEqual([{ kind: 'greeting' }]);
    expect(isBusy(state)).toBe(false);
    expect(hasConversationStarted(state)).toBe(false);
  });

  it('adds the question and starts thinking', () => {
    const state = run({ type: 'userAsked', content: { kind: 'question', question: 'weeklyAllowance' } });
    expect(contents(state).at(-1)).toEqual({ kind: 'question', question: 'weeklyAllowance' });
    expect(state.isThinking).toBe(true);
    expect(isBusy(state)).toBe(true);
    expect(hasConversationStarted(state)).toBe(true);
  });

  it('adds a reply and stops thinking', () => {
    const state = run(
      { type: 'userAsked', content: { kind: 'question', question: 'weeklyAllowance' } },
      { type: 'replied', content: { kind: 'scriptedAnswer', question: 'weeklyAllowance' } },
    );
    expect(contents(state).at(-1)).toEqual({ kind: 'scriptedAnswer', question: 'weeklyAllowance' });
    expect(isBusy(state)).toBe(false);
  });

  it('gives every message its own id', () => {
    const state = run(askText, { type: 'replied', content: { kind: 'notice', notice: 'unsupported' } }, askText);
    const ids = state.messages.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.nextId).toBe(Math.max(...ids) + 1);
  });

  describe('streaming', () => {
    it('keeps thinking until the first words arrive', () => {
      const state = run(askText, { type: 'streamStarted', question: null });
      expect(state.isThinking).toBe(true);
      expect(state.streamingId).not.toBeNull();
    });

    it('appends each piece to the answer being written', () => {
      const state = run(
        askText,
        { type: 'streamStarted', question: null },
        { type: 'streamDelta', text: 'About ' },
        { type: 'streamDelta', text: '323 ₾.' },
      );
      expect(contents(state).at(-1)).toEqual({ kind: 'aiAnswer', text: 'About 323 ₾.', status: 'streaming', question: null });
      expect(state.isThinking).toBe(false);
      expect(isBusy(state)).toBe(true);
    });

    it('ignores pieces when nothing is streaming', () => {
      const state = run(askText);
      expect(conversationReducer(state, { type: 'streamDelta', text: 'late' })).toBe(state);
    });

    it.each(['complete', 'cutShort', 'stopped', 'interrupted'] as const)('keeps the text when the answer ends as %s', (outcome) => {
      const state = run(
        askText,
        { type: 'streamStarted', question: 'saveForGoal' },
        { type: 'streamDelta', text: 'Save 50 ₾ a month.' },
        { type: 'streamEnded', outcome },
      );
      expect(contents(state).at(-1)).toEqual({ kind: 'aiAnswer', text: 'Save 50 ₾ a month.', status: outcome, question: 'saveForGoal' });
      expect(isBusy(state)).toBe(false);
    });

    it('drops a refused answer and shows the fallback instead', () => {
      const state = run(
        askText,
        { type: 'streamStarted', question: null },
        { type: 'streamDelta', text: 'Partial' },
        { type: 'streamEnded', outcome: 'discarded', followUp: { kind: 'notice', notice: 'unsupported' } },
      );
      expect(contents(state).slice(-2)).toEqual([
        { kind: 'userText', text: 'Can I afford a trip?' },
        { kind: 'notice', notice: 'unsupported' },
      ]);
      expect(isBusy(state)).toBe(false);
    });

    it('drops an answer that ended before any words arrived', () => {
      const state = run(
        askText,
        { type: 'streamStarted', question: null },
        { type: 'streamDelta', text: '  ' },
        { type: 'streamEnded', outcome: 'stopped' },
      );
      expect(contents(state).at(-1)).toEqual({ kind: 'userText', text: 'Can I afford a trip?' });
    });

    it('keeps a broken-off answer and adds the explanation after it', () => {
      const state = run(
        askText,
        { type: 'streamStarted', question: null },
        { type: 'streamDelta', text: 'You could' },
        { type: 'streamEnded', outcome: 'interrupted', followUp: { kind: 'failure', failure: 'rateLimited' } },
      );
      expect(contents(state).slice(-2)).toEqual([
        { kind: 'aiAnswer', text: 'You could', status: 'interrupted', question: null },
        { kind: 'failure', failure: 'rateLimited' },
      ]);
    });

    it('adds the follow-up even when no answer had started', () => {
      const state = run(askText, { type: 'streamEnded', outcome: 'interrupted', followUp: { kind: 'failure', failure: 'aiError' } });
      expect(contents(state).at(-1)).toEqual({ kind: 'failure', failure: 'aiError' });
      expect(isBusy(state)).toBe(false);
    });
  });
});

describe('visibleMessages', () => {
  it('hides an AI answer until its first words arrive', () => {
    const waiting = run(askText, { type: 'streamStarted', question: null });
    expect(visibleMessages(waiting.messages).map((message) => message.content.kind)).toEqual(['greeting', 'userText']);

    const writing = conversationReducer(waiting, { type: 'streamDelta', text: 'Yes' });
    expect(visibleMessages(writing.messages).map((message) => message.content.kind)).toEqual(['greeting', 'userText', 'aiAnswer']);
  });
});

describe('lastAnsweredQuestion', () => {
  it('is null before any suggested question is answered', () => {
    expect(lastAnsweredQuestion(initialConversation().messages)).toBeNull();
  });

  it('finds the last scripted answer', () => {
    const state = run(
      { type: 'userAsked', content: { kind: 'question', question: 'weeklyAllowance' } },
      { type: 'replied', content: { kind: 'scriptedAnswer', question: 'weeklyAllowance' } },
      { type: 'userAsked', content: { kind: 'question', question: 'compareLastMonth' } },
      { type: 'replied', content: { kind: 'scriptedAnswer', question: 'compareLastMonth' } },
    );
    expect(lastAnsweredQuestion(state.messages)).toBe('compareLastMonth');
  });

  it('counts finished AI answers to suggested questions', () => {
    const state = run(
      { type: 'userAsked', content: { kind: 'question', question: 'whySpendMore' } },
      { type: 'streamStarted', question: 'whySpendMore' },
      { type: 'streamDelta', text: 'Delivery went up.' },
      { type: 'streamEnded', outcome: 'cutShort' },
    );
    expect(lastAnsweredQuestion(state.messages)).toBe('whySpendMore');
  });

  it('skips free-form answers and unfinished ones', () => {
    const state = run(
      { type: 'userAsked', content: { kind: 'question', question: 'weeklyAllowance' } },
      { type: 'replied', content: { kind: 'scriptedAnswer', question: 'weeklyAllowance' } },
      askText,
      { type: 'streamStarted', question: null },
      { type: 'streamDelta', text: 'Maybe.' },
      { type: 'streamEnded', outcome: 'complete' },
      { type: 'userAsked', content: { kind: 'question', question: 'saveForGoal' } },
      { type: 'streamStarted', question: 'saveForGoal' },
      { type: 'streamDelta', text: 'You' },
      { type: 'streamEnded', outcome: 'stopped' },
    );
    expect(lastAnsweredQuestion(state.messages)).toBe('weeklyAllowance');
  });
});
