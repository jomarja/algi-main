import { CoachScript, createDisplay, EMPTY_HISTORY, type AppLanguage } from '../../../engine/index.ts';
import { sampleFinance, sampleGoals } from '../../../engine/testFixtures.ts';
import { personalizationBlock, scriptedPrompts, scriptedReply, type Personalization } from './scriptedReply.ts';

const allowed: Personalization = { usesTransactions: true, hasAnswersLeft: true };

function script(language: AppLanguage): CoachScript {
  return new CoachScript(sampleFinance(), sampleGoals()[0], createDisplay(language), EMPTY_HISTORY);
}

const prompts = scriptedPrompts([script('en'), script('ka')]);

describe('personalizationBlock', () => {
  it('lets Luka answer when coaching data is on and answers are left', () => {
    expect(personalizationBlock(allowed)).toBeNull();
  });

  it('explains that coaching data is off before anything else, as on iOS', () => {
    expect(personalizationBlock({ usesTransactions: false, hasAnswersLeft: false })).toEqual({ kind: 'notice', notice: 'coachingDataOff' });
  });

  it('offers Premium when the free answers are used up', () => {
    expect(personalizationBlock({ usesTransactions: true, hasAnswersLeft: false })).toEqual({ kind: 'notice', notice: 'limitReached' });
  });
});

describe('scriptedPrompts', () => {
  it('words every suggested question in each language', () => {
    const allowance = prompts.find((prompt) => prompt.question === 'weeklyAllowance');
    expect(allowance?.texts).toEqual(['How much can I spend this week?', 'რამდენი შემიძლია დავხარჯო ამ კვირაში?']);
    expect(prompts).toHaveLength(5);
  });
});

describe('scriptedReply', () => {
  it('answers a suggested question from the script and counts it as personalised', () => {
    expect(scriptedReply({ question: 'compareLastMonth', text: 'ignored' }, allowed, prompts)).toEqual({
      content: { kind: 'scriptedAnswer', question: 'compareLastMonth' },
      isPersonalized: true,
    });
  });

  it('answers a typed question that is a suggested one, in either language', () => {
    expect(scriptedReply({ question: null, text: 'how much can I spend this week' }, allowed, prompts).content).toEqual({
      kind: 'scriptedAnswer',
      question: 'weeklyAllowance',
    });
    expect(scriptedReply({ question: null, text: 'შეადარე ჩემი ხარჯი გასულ თვეს' }, allowed, prompts).content).toEqual({
      kind: 'scriptedAnswer',
      question: 'compareLastMonth',
    });
  });

  it('gives the offline reply to anything else, without counting it', () => {
    expect(scriptedReply({ question: null, text: 'Should I buy a car?' }, allowed, prompts)).toEqual({
      content: { kind: 'notice', notice: 'unsupported' },
      isPersonalized: false,
    });
  });

  it('applies the same limits as a personalised answer', () => {
    expect(scriptedReply({ question: 'saveForGoal', text: '' }, { usesTransactions: true, hasAnswersLeft: false }, prompts)).toEqual({
      content: { kind: 'notice', notice: 'limitReached' },
      isPersonalized: false,
    });
  });
});
