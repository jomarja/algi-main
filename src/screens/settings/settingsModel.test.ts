import { describe, expect, it } from 'vitest';
import { createDisplay, parseIsoDay, tbilisiDate } from '../../engine/index.ts';
import { accountDetail, accountIcon, consentValidUntilText, lastSyncedText, maskedIban } from './settingsModel.ts';

const english = createDisplay('en', 'GEL');
const georgian = createDisplay('ka', 'GEL');
const now = tbilisiDate(2026, 10, 29, 18, 0);

describe('maskedIban', () => {
  it('keeps the country code and last four digits', () => {
    expect(maskedIban('GE29TB7894545081004821')).toBe('GE•• •••• 4821');
  });

  it('ignores spaces in the IBAN', () => {
    expect(maskedIban('GE29 TB78 9454 5081 0048 21')).toBe('GE•• •••• 4821');
  });

  it('leaves values too short to mask unchanged', () => {
    expect(maskedIban('GE12')).toBe('GE12');
  });
});

describe('accountDetail', () => {
  it('shows the masked IBAN and the currency', () => {
    expect(accountDetail({ iban: 'GE82TB7724936515100001', currency: 'USD' })).toBe('GE•• •••• 0001 · USD');
  });

  it('shows only the currency without an IBAN', () => {
    expect(accountDetail({ iban: '', currency: 'GEL' })).toBe('GEL');
  });
});

describe('accountIcon', () => {
  it('uses a banknote for savings and a card for everything else', () => {
    expect(accountIcon('savings')).toBe('banknote');
    expect(accountIcon('current')).toBe('creditcard');
    expect(accountIcon('card')).toBe('creditcard');
  });
});

describe('lastSyncedText', () => {
  it('says when the data was last fetched', () => {
    const synced = tbilisiDate(2026, 10, 29, 14, 5);
    expect(lastSyncedText(synced.toISOString(), now, english)).toBe(`Last synced: Today, ${english.date(synced, 'time')}`);
    expect(lastSyncedText(synced.toISOString(), now, georgian)).toBe(`ბოლო განახლება: დღეს, ${georgian.date(synced, 'time')}`);
  });

  it('says it has not synced without a usable timestamp', () => {
    expect(lastSyncedText(null, now, english)).toBe('Not synced yet');
    expect(lastSyncedText('not a date', now, english)).toBe('Not synced yet');
  });
});

describe('consentValidUntilText', () => {
  it('formats the consent end date', () => {
    const consent = { id: 'c1', status: 'valid', validUntil: '2027-01-27' };
    const expected = parseIsoDay('2027-01-27');
    expect(expected).not.toBeNull();
    expect(consentValidUntilText(consent, english)).toBe(english.date(expected as Date, 'dayMonthYear'));
  });

  it('returns null without a consent or with an unreadable date', () => {
    expect(consentValidUntilText(null, english)).toBeNull();
    expect(consentValidUntilText({ id: 'c1', status: 'valid', validUntil: 'soon' }, english)).toBeNull();
  });
});
