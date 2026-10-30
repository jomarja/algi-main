import type { CoachMessage } from '../../../../shared/coach.ts';
import type { ChatContent, ChatMessage } from './conversation.ts';
import { chatRequestMessages, MAX_HISTORY_MESSAGES, recentHistory, toCoachMessages, type ScriptTexts } from './history.ts';

const texts: ScriptTexts = {
  prompt: (question) => `prompt:${question}`,
  answer: (question) => `answer:${question}`,
};

function messagesOf(...contents: ChatContent[]): ChatMessage[] {
  return contents.map((content, id) => ({ id, content }));
}

function turns(count: number): CoachMessage[] {
  return Array.from({ length: count }, (_, index): CoachMessage => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `turn ${index}`,
  }));
}

describe('toCoachMessages', () => {
  it('turns questions and answers into turns, using the script for scripted ones', () => {
    const messages = messagesOf(
      { kind: 'question', question: 'weeklyAllowance' },
      { kind: 'scriptedAnswer', question: 'weeklyAllowance' },
      { kind: 'userText', text: 'And next month?' },
      { kind: 'aiAnswer', text: 'About the same.', status: 'complete', question: null },
    );
    expect(toCoachMessages(messages, texts)).toEqual([
      { role: 'user', content: 'prompt:weeklyAllowance' },
      { role: 'assistant', content: 'answer:weeklyAllowance' },
      { role: 'user', content: 'And next month?' },
      { role: 'assistant', content: 'About the same.' },
    ]);
  });

  it("leaves out the greeting and Luka's notices", () => {
    const messages = messagesOf(
      { kind: 'greeting' },
      { kind: 'userText', text: 'Hi' },
      { kind: 'notice', notice: 'limitReached' },
      { kind: 'failure', failure: 'rateLimited' },
    );
    expect(toCoachMessages(messages, texts)).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('keeps partial answers but drops empty ones', () => {
    const messages = messagesOf(
      { kind: 'userText', text: 'Hi' },
      { kind: 'aiAnswer', text: 'You could', status: 'stopped', question: null },
      { kind: 'aiAnswer', text: '   ', status: 'streaming', question: null },
    );
    expect(toCoachMessages(messages, texts)).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'You could' },
    ]);
  });
});

describe('recentHistory', () => {
  it('keeps short conversations whole', () => {
    expect(recentHistory(turns(5))).toEqual(turns(5));
  });

  it(`keeps only the last ${MAX_HISTORY_MESSAGES} turns`, () => {
    const history = recentHistory(turns(32));
    expect(history).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(history[0]).toEqual({ role: 'user', content: 'turn 12' });
    expect(history.at(-1)).toEqual({ role: 'assistant', content: 'turn 31' });
  });

  it("starts with one of the user's turns", () => {
    const history = recentHistory(turns(21));
    expect(history[0]).toEqual({ role: 'user', content: 'turn 2' });
    expect(history).toHaveLength(MAX_HISTORY_MESSAGES - 1);
  });

  it('is empty without a user turn', () => {
    expect(recentHistory([{ role: 'assistant', content: 'Hello' }])).toEqual([]);
  });
});

describe('chatRequestMessages', () => {
  it('ends with the new question', () => {
    const messages = messagesOf(
      { kind: 'greeting' },
      { kind: 'question', question: 'compareLastMonth' },
      { kind: 'scriptedAnswer', question: 'compareLastMonth' },
      { kind: 'userText', text: 'Why?' },
    );
    expect(chatRequestMessages(messages, texts)).toEqual([
      { role: 'user', content: 'prompt:compareLastMonth' },
      { role: 'assistant', content: 'answer:compareLastMonth' },
      { role: 'user', content: 'Why?' },
    ]);
  });
});
