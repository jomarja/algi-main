import { isApiError } from '../../../api/http.ts';
import { lt, type LocalizedText } from '../../../engine/index.ts';
import { formatCount, MAX_MESSAGE_CHARS } from '../chat/messageLimit.ts';

/** What went wrong with an AI coach request, in terms of what the screen does about it. */
export type CoachFailure =
  /** The AI can't be reached (no API key, overloaded, offline): Luka answers from his script. */
  | 'offline'
  | 'rateLimited'
  | 'aiError'
  | 'bankNotConnected'
  | 'bankUnavailable'
  | 'bankRateLimited'
  | 'tooLong'
  /** The user stopped it, or left the screen. */
  | 'cancelled';

/** Failures Luka explains in the chat; offline questions are answered from the script, and a cancel says nothing. */
export type CoachFailureNotice = Exclude<CoachFailure, 'offline' | 'cancelled'>;

/** Server error codes (server/ai/claude.ts, server/openbanking/errors.ts, server/ai/validation.ts). */
const failuresByCode = new Map<string, CoachFailure>([
  ['ai_unavailable', 'offline'],
  ['rate_limited', 'rateLimited'],
  ['ai_error', 'aiError'],
  ['ai_refused', 'aiError'],
  ['internal_error', 'aiError'],
  ['not_connected', 'bankNotConnected'],
  ['bank_unavailable', 'bankUnavailable'],
  ['bank_unreachable', 'bankUnavailable'],
  ['bank_request_rejected', 'bankUnavailable'],
  ['bank_rate_limited', 'bankRateLimited'],
  ['message_too_long', 'tooLong'],
  ['payload_too_large', 'tooLong'],
]);

/** A gateway's own error page (no JSON code) means the app's server can't be reached. */
const gatewayStatuses = new Set([502, 503, 504]);

export function classifyCoachError(error: unknown): CoachFailure {
  if (!isApiError(error)) return 'aiError';
  switch (error.kind) {
    case 'aborted':
      return 'cancelled';
    case 'network':
    case 'timeout':
      return 'offline';
    case 'stream':
      return failuresByCode.get(error.code) ?? 'aiError';
    case 'http':
      return failuresByCode.get(error.code) ?? (gatewayStatuses.has(error.status) ? 'offline' : 'aiError');
    case 'invalid_response':
      return 'aiError';
  }
}

export function isFailureNotice(failure: CoachFailure): failure is CoachFailureNotice {
  return failure !== 'offline' && failure !== 'cancelled';
}

/** Luka's friendly explanation of a failure, in both languages. */
export function coachFailureMessage(failure: CoachFailureNotice): LocalizedText {
  switch (failure) {
    case 'rateLimited':
      return lt(
        'Lots of people are asking me things right now. Give me a minute and try again.',
        'ახლა ბევრი მეკითხება. ერთი წუთი მაცალე და თავიდან სცადე.',
      );
    case 'aiError':
      return lt('Something went wrong on my side. Please try asking again.', 'ჩემს მხარეს რაღაც შეფერხდა. სცადე, თავიდან მკითხო.');
    case 'bankNotConnected':
      return lt(
        "I can't see your TBC Bank data right now — the connection needs renewing. Connect TBC Bank again, then ask me.",
        'TBC ბანკის მონაცემებს ახლა ვერ ვხედავ — კავშირი განსაახლებელია. TBC ბანკი თავიდან დააკავშირე და მერე მკითხე.',
      );
    case 'bankUnavailable':
      return lt("I couldn't reach TBC Bank just now. Try again in a moment.", 'TBC ბანკს ახლა ვერ დავუკავშირდი. ცოტა ხანში სცადე თავიდან.');
    case 'bankRateLimited':
      return lt(
        'TBC limits how often your data can be read. Try again a little later.',
        'TBC ზღუდავს, რამდენად ხშირად შეიძლება შენი მონაცემების წაკითხვა. ცოტა მოგვიანებით სცადე.',
      );
    case 'tooLong':
      return lt(
        `That's a bit long for me. Keep questions under ${formatCount(MAX_MESSAGE_CHARS, 'en')} characters.`,
        `ეს ცოტა გრძელია. კითხვა ${formatCount(MAX_MESSAGE_CHARS, 'ka')} სიმბოლოზე მოკლე უნდა იყოს.`,
      );
  }
}
