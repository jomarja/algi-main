import type { CoachAction, CoachRecommendation } from '../../../../shared/coach.ts';
import {
  lt,
  money,
  type Display,
  type LocalizedText,
  type MascotPose,
  type PaletteToken,
  type RecommendationTone,
  type TagTone,
} from '../../../engine/index.ts';

/** RecommendationTone.background on iOS. */
export const toneBackgrounds: Readonly<Record<RecommendationTone, PaletteToken>> = {
  nextStep: 'amberPale',
  positive: 'mintPale',
  attention: 'coralPale',
};

interface PriorityLook {
  readonly pose: MascotPose;
  readonly tone: RecommendationTone;
  readonly tagTone: TagTone;
  readonly label: LocalizedText;
}

/** How an AI suggestion looks, by the priority Luka gave it (server/ai/prompts.ts defines the levels). */
export const priorityLooks: Readonly<Record<CoachRecommendation['priority'], PriorityLook>> = {
  high: { pose: 'overspending', tone: 'attention', tagTone: 'attention', label: lt('Act soon', 'მალე იმოქმედე') },
  medium: { pose: 'insight', tone: 'nextStep', tagTone: 'neutral', label: lt('Opportunity', 'შესაძლებლობა') },
  low: { pose: 'savings', tone: 'positive', tagTone: 'positive', label: lt('Good to know', 'კარგია, რომ იცი') },
};

const actionTitles: Readonly<Record<CoachAction, LocalizedText | null>> = {
  review_budget: lt('Review essentials & flexible', 'გადახედე აუცილებელს და მოქნილს'),
  plan_goal: lt('Plan a goal', 'მიზნის დაგეგმვა'),
  compare_loan: lt('Compare loans', 'სესხების შედარება'),
  what_if: lt('Try it in What if…', 'სცადე „რა მოხდება, თუ…“'),
  open_transactions: lt('See transactions', 'ტრანზაქციების ნახვა'),
  none: null,
};

/** The button title of an AI suggestion's next step; null when it needs no action. */
export function actionTitle(action: CoachAction): LocalizedText | null {
  return actionTitles[action];
}

/** "About 60 ₾ a month" for a suggestion with an estimated monthly impact (given in the display currency). */
export function monthlyImpactText(recommendation: CoachRecommendation, display: Display): string | null {
  if (recommendation.impactMonthly === null) return null;
  const amount = display.money(money(recommendation.impactMonthly, display.currency), { precision: 'whole' });
  return display.t(`About ${amount} a month`, `თვეში დაახლოებით ${amount}`);
}
