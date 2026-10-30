import { lt, type LocalizedText } from './localization.ts';

/** The Home greeting for an hour of the day (0–23, Tbilisi time). */
export function greetingText(hour: number): LocalizedText {
  if (hour >= 5 && hour < 12) return lt('Good morning', 'დილა მშვიდობისა');
  if (hour >= 12 && hour < 18) return lt('Good afternoon', 'შუადღე მშვიდობისა');
  return lt('Good evening', 'საღამო მშვიდობისა');
}
