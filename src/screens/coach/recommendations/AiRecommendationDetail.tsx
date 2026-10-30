import type { CoachRecommendation } from '../../../../shared/coach.ts';
import { ButtonLink, Card, DetailRow, IllustrationStage, Tag } from '../../../design/index.ts';
import { CATEGORY_META } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { coachActionPath } from './destinations.ts';
import { actionTitle, monthlyImpactText, priorityLooks, toneBackgrounds } from './presentation.ts';
import { WhyCard, WhyFact } from './WhyCard.tsx';

interface AiRecommendationDetailProps {
  recommendation: CoachRecommendation;
  generatedAt: Date;
}

/**
 * One of Luka's AI suggestions in full, laid out like the app's own: what he noticed, why, the estimate, the
 * screen to act on it, and the facts from the user's data he based it on (shown open, since they are the proof).
 */
export function AiRecommendationDetail({ recommendation, generatedAt }: AiRecommendationDetailProps) {
  const display = useDisplay();
  const look = priorityLooks[recommendation.priority];
  const impact = monthlyImpactText(recommendation, display);
  const actionPath = coachActionPath(recommendation.action);
  const action = actionTitle(recommendation.action);
  const category = recommendation.category ? CATEGORY_META[recommendation.category] : null;

  return (
    <>
      <IllustrationStage pose={look.pose} background={toneBackgrounds[look.tone]} height={200} className="rounded-xl" />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Tag text={display.text(look.label)} tone={look.tagTone} />
          <Tag text={display.t('Written with AI', 'AI-ით დაწერილი')} tone="estimate" icon="sparkles" />
        </div>
        <h2 className="type-title3 text-ink">{recommendation.title}</h2>
        <p className="type-body text-inkSoft">{recommendation.detail}</p>
      </div>

      {(impact || category) && (
        <Card>
          {impact && <DetailRow title={display.t('Estimated impact', 'სავარაუდო ეფექტი')} value={impact} />}
          {category && <DetailRow title={display.t('Category', 'კატეგორია')} value={display.text(category.title)} />}
        </Card>
      )}

      {actionPath && action && <ButtonLink to={actionPath}>{display.text(action)}</ButtonLink>}

      <WhyCard isInitiallyExpanded>
        {recommendation.evidence.map((fact, index) => (
          <WhyFact key={index}>{fact}</WhyFact>
        ))}
        <p className="type-caption text-inkMuted">
          {display.t(
            `From your bank data at ${display.date(generatedAt, 'time')}. Check the figures before you act on them.`,
            `შენი საბანკო მონაცემებიდან, ${display.date(generatedAt, 'time')}-ზე. მოქმედებამდე რიცხვები გადაამოწმე.`,
          )}
        </p>
      </WhyCard>
    </>
  );
}
