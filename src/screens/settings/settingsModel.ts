import type { BankAccount, BankConsent } from '../../../shared/bank.ts';
import { parseIsoDay, type Display } from '../../engine/index.ts';

const MASK = '••';

/** An IBAN with only its country and last four digits showing, e.g. "GE•• •••• 4821". */
export function maskedIban(iban: string): string {
  const compact = iban.replace(/\s+/g, '');
  if (compact.length < 8) return compact;
  return `${compact.slice(0, 2)}${MASK} ${MASK}${MASK} ${compact.slice(-4)}`;
}

/**
 * The line under an account's name: masked IBAN and currency, e.g. "GE•• •••• 0001 · USD". TBC lists each currency
 * of a multi-currency account separately under the same IBAN, so the currency tells them apart.
 */
export function accountDetail(account: Pick<BankAccount, 'iban' | 'currency'>): string {
  return [maskedIban(account.iban), account.currency].filter((part) => part !== '').join(' · ');
}

/** SF Symbol for an account row, as in the iOS accounts section. */
export function accountIcon(kind: BankAccount['kind']): string {
  return kind === 'savings' ? 'banknote' : 'creditcard';
}

/** "Last synced: Today, 14:05", or that it hasn't synced yet. */
export function lastSyncedText(lastSyncedAt: string | null, now: Date, display: Display): string {
  const synced = lastSyncedAt ? new Date(lastSyncedAt) : null;
  if (!synced || Number.isNaN(synced.getTime())) return display.t('Not synced yet', 'ჯერ არ განახლებულა');
  const when = `${display.relativeDay(synced, now)}, ${display.date(synced, 'time')}`;
  return display.t(`Last synced: ${when}`, `ბოლო განახლება: ${when}`);
}

/** When the PSD2 consent runs out, e.g. "28 January 2027"; null when the bank didn't say. */
export function consentValidUntilText(consent: BankConsent | null, display: Display): string | null {
  const validUntil = consent ? parseIsoDay(consent.validUntil) : null;
  return validUntil ? display.date(validUntil, 'dayMonthYear') : null;
}
