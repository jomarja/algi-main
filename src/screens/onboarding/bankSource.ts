import type { BankDataSourceKind } from '../../../shared/bank.ts';
import { lt, type LocalizedText } from '../../engine/index.ts';

/**
 * How Algi describes where bank data comes from, honestly: the built-in simulation of TBC's API, TBC's sandbox,
 * or TBC itself. Every bank surface (onboarding, consent, Home, Settings) reads its wording from here.
 */
export interface BankSourceCopy {
  /** A small tag next to TBC Bank; null for the real bank, which needs no label. */
  readonly tag: LocalizedText | null;
  /** One line under the bank options. */
  readonly note: LocalizedText;
  /** The consent sheet's banner. */
  readonly consentTitle: LocalizedText;
  readonly consentMessage: LocalizedText;
}

export const BANK_SOURCE_COPY: Readonly<Record<BankDataSourceKind, BankSourceCopy>> = {
  mock: {
    tag: lt('Sandbox simulation', 'სატესტო სიმულაცია'),
    note: lt(
      "This build connects to a simulation of TBC's Open Banking API, so no real bank data is used.",
      'ეს ვერსია TBC-ის ღია ბანკინგის სიმულაციას უკავშირდება, ამიტომ რეალური საბანკო მონაცემები არ გამოიყენება.',
    ),
    consentTitle: lt('Sandbox simulation', 'სატესტო სიმულაცია'),
    consentMessage: lt(
      "You'll approve access on a simulated TBC consent page. No real bank data is involved.",
      'წვდომას TBC-ის თანხმობის სიმულირებულ გვერდზე დაადასტურებ. რეალური საბანკო მონაცემები არ გამოიყენება.',
    ),
  },
  'tbc-sandbox': {
    tag: lt('TBC sandbox', 'TBC-ის სატესტო გარემო'),
    note: lt(
      "This build connects to TBC's sandbox, which holds test data only.",
      'ეს ვერსია TBC-ის სატესტო გარემოს უკავშირდება, სადაც მხოლოდ სატესტო მონაცემებია.',
    ),
    consentTitle: lt('TBC sandbox', 'TBC-ის სატესტო გარემო'),
    consentMessage: lt(
      "You'll sign in on TBC's test environment. Only test data is shared.",
      'TBC-ის სატესტო გარემოში შეხვალ. მხოლოდ სატესტო მონაცემები გაზიარდება.',
    ),
  },
  'tbc-production': {
    tag: null,
    note: lt(
      "Read-only access through TBC Bank's Open Banking, approved on TBC's own page.",
      'მხოლოდ ნახვის წვდომა TBC ბანკის ღია ბანკინგით, რომელსაც TBC-ის საკუთარ გვერდზე დაადასტურებ.',
    ),
    consentTitle: lt("You'll continue at TBC Bank", 'გაგრძელება TBC ბანკის გვერდზე'),
    consentMessage: lt(
      "Sign in and approve access on TBC's own page. Algi never sees your online banking password.",
      'შედი და დაადასტურე წვდომა TBC-ის საკუთარ გვერდზე. Algi შენს ინტერნეტბანკის პაროლს ვერასდროს ხედავს.',
    ),
  },
};

/** The copy for a data source, or null before the server has said which one it uses. */
export function bankSourceCopy(source: BankDataSourceKind | null | undefined): BankSourceCopy | null {
  return source ? BANK_SOURCE_COPY[source] : null;
}
