import { NON_BREAKING_SPACE, type AppLanguage } from '../../../engine/index.ts';

/** Longest question the server accepts (server/ai/validation.ts). */
export const MAX_MESSAGE_CHARS = 4_000;

/** The composer shows a character count from here on, so the limit never comes as a surprise. */
export const COUNTER_FROM_CHARS = 3_500;

/**
 * A whole count grouped the way the app writes amounts (engine/moneyFormatter.ts): "4,000" / "4 000".
 * Intl's Georgian locale leaves four-digit numbers ungrouped, which would disagree with the rest of the app.
 */
export function formatCount(value: number, language: AppLanguage): string {
  const separator = language === 'ka' ? NON_BREAKING_SPACE : ',';
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
