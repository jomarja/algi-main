import { useId } from 'react';
import type { CoachRecommendation } from '../../../../shared/coach.ts';
import { Button, Icon, Overline, SkeletonCard, Spinner, StatusBanner } from '../../../design/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { coachFailureMessage, isFailureNotice } from '../shared/coachErrors.ts';
import { shownResponse } from './aiRecommendationsCache.ts';
import { recommendationPath } from './destinations.ts';
import { actionTitle, monthlyImpactText, priorityLooks } from './presentation.ts';
import { SuggestionRow } from './SuggestionRow.tsx';
import type { AiRecommendations } from './useAiRecommendations.ts';

const skeletonCount = 3;

function AiSuggestionRow({ recommendation }: { recommendation: CoachRecommendation }) {
  const display = useDisplay();
  const look = priorityLooks[recommendation.priority];
  const action = actionTitle(recommendation.action);

  return (
    <SuggestionRow
      pose={look.pose}
      tone={look.tone}
      title={recommendation.title}
      caption={monthlyImpactText(recommendation, display) ?? undefined}
      nextStep={action ? display.text(action) : display.t('See the details', 'დეტალები')}
      to={recommendationPath({ source: 'ai', id: recommendation.id })}
    />
  );
}

/** The suggestions, or their loading and failure states. */
function SuggestionsBody({ ai }: { ai: AiRecommendations }) {
  const display = useDisplay();
  const { snapshot } = ai;
  const response = shownResponse(snapshot);

  return (
    <>
      <p className="type-footnote text-inkSoft">
        {display.t(
          'Written with AI from your latest bank data. Check the figures before you act on them.',
          'ლუკამ AI-ით დაწერა შენი ბოლო საბანკო მონაცემებით. მოქმედებამდე რიცხვები გადაამოწმე.',
        )}
      </p>

      {snapshot.status === 'failed' && isFailureNotice(snapshot.failure) && (
        <div className="flex flex-col gap-2">
          <StatusBanner
            kind="warning"
            title={display.t("Luka couldn't write new suggestions", 'ლუკამ ახალი რჩევები ვერ დაწერა')}
            message={display.text(coachFailureMessage(snapshot.failure))}
          />
          <Button kind="tertiary" icon="arrow.clockwise" onClick={ai.refresh} className="self-start">
            {display.t('Try again', 'თავიდან ცდა')}
          </Button>
        </div>
      )}

      {snapshot.status === 'loading' && !response && (
        <div role="status" className="flex flex-col gap-3">
          {Array.from({ length: skeletonCount }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
          <p className="type-caption text-center text-inkSoft">
            {display.t(
              'Luka is looking through your accounts. This can take up to a minute.',
              'ლუკა შენს ანგარიშებს ათვალიერებს. ამას შეიძლება ერთ წუთამდე დასჭირდეს.',
            )}
          </p>
        </div>
      )}

      {response && (
        <>
          <ul className="flex flex-col gap-4">
            {response.recommendations.map((recommendation) => (
              <li key={recommendation.id}>
                <AiSuggestionRow recommendation={recommendation} />
              </li>
            ))}
          </ul>
          <p className="type-caption text-inkMuted">
            {display.t(
              `Updated at ${display.date(new Date(response.generatedAt), 'time')}`,
              `განახლდა ${display.date(new Date(response.generatedAt), 'time')}-ზე`,
            )}
          </p>
        </>
      )}
    </>
  );
}

interface FreshFromLukaSectionProps {
  ai: AiRecommendations;
  /** Luka's explanation when coaching data is switched off (CoachScript.coachingDataOff). */
  coachingDataOffText: string;
}

/**
 * Luka's AI suggestions above the app's own: written from the latest bank data when the list opens, kept for the
 * session, with a Refresh button. Hidden while the AI is offline, so the screen falls back to the iOS list.
 */
export function FreshFromLukaSection({ ai, coachingDataOffText }: FreshFromLukaSectionProps) {
  const display = useDisplay();
  const titleId = useId();
  const isLoading = ai.snapshot.status === 'loading';

  if (ai.availability !== 'online') return null;

  return (
    <section aria-labelledby={titleId} aria-busy={isLoading} className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Overline tone="mintDark" icon="sparkles">
            {display.t('AI suggestions', 'AI რჩევები')}
          </Overline>
          <h2 id={titleId} className="type-title3 text-ink">
            {display.t('Fresh from Luka', 'ახალი რჩევები ლუკასგან')}
          </h2>
        </div>
        {!ai.isCoachingDataOff && (
          <button
            type="button"
            onClick={ai.refresh}
            disabled={isLoading}
            className="type-subheadline pressable-dim inline-flex min-h-[44px] shrink-0 items-center gap-1 font-semibold text-mintDark disabled:text-inkMuted"
          >
            {isLoading ? <Spinner size={15} /> : <Icon name="arrow.clockwise" size={15} />}
            {display.t('Refresh', 'განახლება')}
          </button>
        )}
      </div>

      {ai.isCoachingDataOff ? <p className="type-footnote text-inkSoft">{coachingDataOffText}</p> : <SuggestionsBody ai={ai} />}
    </section>
  );
}
