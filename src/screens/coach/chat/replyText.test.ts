import { CoachScript, createDisplay, EMPTY_HISTORY } from '../../../engine/index.ts';
import { sampleFinance, sampleGoals } from '../../../engine/testFixtures.ts';
import type { ChatContent } from './conversation.ts';
import { noticeText, spokenReply } from './replyText.ts';

const display = createDisplay('en');
const script = new CoachScript(sampleFinance(), sampleGoals()[0], display, EMPTY_HISTORY);

function spoken(content: ChatContent): string | null {
  return spokenReply({ id: 1, content }, script, display);
}

describe('noticeText', () => {
  it("uses Luka's scripted wording", () => {
    expect(noticeText('unsupported', script)).toBe(script.unsupportedQuestion);
    expect(noticeText('coachingDataOff', script)).toBe(script.coachingDataOff);
    expect(noticeText('limitReached', script)).toBe(script.limitReached);
  });
});

describe('spokenReply', () => {
  it('reads a finished AI answer without its markup', () => {
    expect(spoken({ kind: 'aiAnswer', text: 'You have **323 ₾** left.', status: 'complete', question: null })).toBe('You have 323 ₾ left.');
  });

  it('waits until a streaming answer ends', () => {
    expect(spoken({ kind: 'aiAnswer', text: 'You have', status: 'streaming', question: null })).toBeNull();
  });

  it("reads Luka's scripted replies and explanations", () => {
    expect(spoken({ kind: 'scriptedAnswer', question: 'weeklyAllowance' })).toBe(script.reply('weeklyAllowance').text);
    expect(spoken({ kind: 'notice', notice: 'limitReached' })).toBe(script.limitReached);
    expect(spoken({ kind: 'failure', failure: 'rateLimited' })).toContain('minute');
  });

  it("doesn't repeat the user's own messages or the greeting", () => {
    expect(spoken({ kind: 'userText', text: 'Hi' })).toBeNull();
    expect(spoken({ kind: 'question', question: 'weeklyAllowance' })).toBeNull();
    expect(spoken({ kind: 'greeting' })).toBeNull();
  });
});
