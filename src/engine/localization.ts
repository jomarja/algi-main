/** Languages the app ships in. Copy is resolved at runtime so the language can switch in-app. */
export type AppLanguage = 'en' | 'ka';

/** A piece of copy available in every supported language. */
export interface LocalizedText {
  readonly en: string;
  readonly ka: string;
}

export function lt(en: string, ka: string): LocalizedText {
  return { en, ka };
}

export function resolveText(text: LocalizedText, language: AppLanguage): string {
  return text[language];
}

export const APP_LANGUAGES: readonly AppLanguage[] = ['en', 'ka'];

export interface LanguageInfo {
  readonly nativeName: string;
  readonly shortName: string;
  /** BCP 47 locale used for dates and lists, matching the iOS app's en_GB / ka_GE. */
  readonly locale: string;
}

export const LANGUAGE_INFO: Readonly<Record<AppLanguage, LanguageInfo>> = {
  en: { nativeName: 'English', shortName: 'EN', locale: 'en-GB' },
  ka: { nativeName: 'ქართული', shortName: 'ქარ', locale: 'ka-GE' },
};

const listFormatters = new Map<AppLanguage, Intl.ListFormat>();

/** Joins items the way the language does, e.g. "A, B and C" / "A, B და C". */
export function joinList(items: readonly string[], language: AppLanguage): string {
  try {
    return listFormatter(language).format(items);
  } catch {
    return items.join(', ');
  }
}

function listFormatter(language: AppLanguage): Intl.ListFormat {
  const cached = listFormatters.get(language);
  if (cached) return cached;
  const formatter = new Intl.ListFormat(LANGUAGE_INFO[language].locale, { style: 'long', type: 'conjunction' });
  listFormatters.set(language, formatter);
  return formatter;
}
