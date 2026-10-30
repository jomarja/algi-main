import { matchScriptedQuestion, normalizeQuestion, type ScriptedPrompt } from './scriptMatching.ts';

const prompts: ScriptedPrompt[] = [
  { question: 'weeklyAllowance', texts: ['How much can I spend this week?', 'რამდენი შემიძლია დავხარჯო ამ კვირაში?'] },
  { question: 'saveForGoal', texts: ['How can I save 4,000 ₾?', 'როგორ დავზოგო 4 000 ₾?'] },
];

describe('normalizeQuestion', () => {
  it('ignores case, punctuation, symbols and spacing', () => {
    expect(normalizeQuestion('  How much can I SPEND, this week?! ')).toBe('how much can i spend this week');
  });

  it('keeps Georgian letters', () => {
    expect(normalizeQuestion('რამდენი შემიძლია დავხარჯო ამ კვირაში?')).toBe('რამდენი შემიძლია დავხარჯო ამ კვირაში');
  });
});

describe('matchScriptedQuestion', () => {
  it('matches a suggested question typed in English or Georgian', () => {
    expect(matchScriptedQuestion('how much can i spend this week', prompts)).toBe('weeklyAllowance');
    expect(matchScriptedQuestion('რამდენი შემიძლია დავხარჯო ამ კვირაში', prompts)).toBe('weeklyAllowance');
  });

  it('matches amounts however they are grouped', () => {
    expect(matchScriptedQuestion('How can I save 4 000 ₾?', prompts)).toBe('saveForGoal');
    expect(matchScriptedQuestion('როგორ დავზოგო 4 000 ₾', prompts)).toBe('saveForGoal');
  });

  it('does not guess at other questions', () => {
    expect(matchScriptedQuestion('How much did I spend on taxis?', prompts)).toBeNull();
    expect(matchScriptedQuestion('?!', prompts)).toBeNull();
  });
});
