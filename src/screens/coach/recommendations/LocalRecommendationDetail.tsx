import { ButtonLink, Card, DetailRow, IllustrationStage } from '../../../design/index.ts';
import type { ProactiveRecommendation } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { SupportingTransactionRow } from '../shared/SupportingTransactionRow.tsx';
import { coachDestinationPath } from './destinations.ts';
import { toneBackgrounds } from './presentation.ts';
import { WhyCard, WhyFact } from './WhyCard.tsx';

interface LocalRecommendationDetailProps {
  recommendation: ProactiveRecommendation;
  now: Date;
}

/** One of the app's suggestions in full (RecommendationDetailView): explanation, figures, next step, and the data behind it. */
export function LocalRecommendationDetail({ recommendation, now }: LocalRecommendationDetailProps) {
  const display = useDisplay();
  const hasEvidence = recommendation.assumptions.length > 0 || recommendation.transactions.length > 0;

  return (
    <>
      <IllustrationStage pose={recommendation.pose} background={toneBackgrounds[recommendation.tone]} height={200} className="rounded-xl" />

      <div className="flex flex-col gap-2">
        <h2 className="type-title3 text-ink">{recommendation.title}</h2>
        <p className="type-body text-inkSoft">{recommendation.explanation}</p>
      </div>

      {recommendation.figures.length > 0 && (
        <Card>
          {recommendation.figures.map((figure) => (
            <DetailRow key={figure.label} title={figure.label} value={figure.value} />
          ))}
        </Card>
      )}

      <ButtonLink to={coachDestinationPath(recommendation.destination, display.language)}>{recommendation.nextStep}</ButtonLink>

      <WhyCard>
        {recommendation.assumptions.map((assumption, index) => (
          <WhyFact key={index}>{assumption}</WhyFact>
        ))}
        {recommendation.transactions.map((transaction) => (
          <SupportingTransactionRow key={transaction.id} transaction={transaction} now={now} />
        ))}
        {!hasEvidence && (
          <p className="type-footnote text-inkSoft">{display.t('Based on your goals and plan.', 'ეფუძნება შენს მიზნებსა და გეგმას.')}</p>
        )}
      </WhyCard>
    </>
  );
}
