import { useState } from 'react';
import { Button, Card, IllustrationStage, Overline, Tag } from '../../design/index.ts';
import type { InsightContent, InsightKind } from '../../engine/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { DashboardColumns, ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { SpendingInterventionSheet } from '../intervention/SpendingInterventionSheet.tsx';
import { ContentUnavailable } from '../plan/shared/ContentUnavailable.tsx';
import { MethodDisclosure } from '../plan/shared/MethodDisclosure.tsx';
import { InsightBarChart } from './InsightBarChart.tsx';
import { isInsightKind } from './insightsModel.ts';
import { InsightTransactions } from './InsightTransactions.tsx';

/**
 * One insight in depth (InsightDetailView.swift): what happened, a practical next step, how it was worked out, and
 * the transactions behind it. `:insightId` is an InsightKind.
 */
export default function InsightDetailScreen({ params }: ScreenProps) {
  const display = useDisplay();
  const kind = params.insightId;

  if (!isInsightKind(kind)) {
    return (
      <ScreenLayout title={display.t('Insight', 'ანალიზი')}>
        <ContentUnavailable icon="chart.bar.xaxis" title={display.t('Nothing here', 'აქ არაფერია')} />
      </ScreenLayout>
    );
  }
  return <InsightDetail kind={kind} />;
}

function InsightDetail({ kind }: { kind: InsightKind }) {
  const store = useAppStore();
  const display = useDisplay();
  const content = store.insights(display).content(kind);

  return (
    <ScreenLayout title={display.t('Insight', 'ანალიზი')} width="wide">
      <DashboardColumns
        main={
          <>
            <IllustrationStage pose={content.pose} background={content.background} height={220} className="rounded-xl" />
            <div className="flex flex-col gap-2">
              <h2 className="type-title text-ink">{content.title}</h2>
              <p className="type-body text-inkSoft">{content.summary}</p>
            </div>
            <InsightBarChart content={content} />
          </>
        }
        aside={
          <>
            <Recommendation content={content} />
            <MethodDisclosure icon="questionmark.circle">
              <p className="type-footnote text-ink">{content.method}</p>
              <p className="type-footnote text-inkSoft">{content.dataBasis}</p>
              <Tag
                text={display.t('Suggestions are estimates, not guarantees', 'რჩევები შეფასებაა და არა გარანტია')}
                tone="estimate"
                icon="info.circle"
                className="!shrink !whitespace-normal"
              />
            </MethodDisclosure>
            <InsightTransactions transactions={content.relatedTransactions} now={store.now} />
          </>
        }
      />
    </ScreenLayout>
  );
}

/** "What you could do": the suggestion, a way to act on it, and a way to talk it through with the coach. */
function Recommendation({ content }: { content: InsightContent }) {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const [isAdjustingBudget, setAdjustingBudget] = useState(false);
  const isDelivery = content.kind === 'deliveryIncrease';

  const askCoach = () => {
    store.askCoach(isDelivery ? 'whySpendMore' : 'changeNextWeek');
    router.navigate('/coach');
  };

  return (
    <Card background="amberPale" bordered={false} className="flex flex-col gap-3">
      <Overline as="h2" tone="ink" icon="sparkles">
        {display.t('What you could do', 'რისი გაკეთება შეგიძლია')}
      </Overline>
      <p className="type-callout font-medium text-ink">{content.recommendation}</p>
      {isDelivery && (
        <>
          <Button onClick={() => setAdjustingBudget(true)}>{display.t('Adjust my delivery budget', 'მიტანის ბიუჯეტის შეცვლა')}</Button>
          <SpendingInterventionSheet isOpen={isAdjustingBudget} onClose={() => setAdjustingBudget(false)} />
        </>
      )}
      <Button kind="secondary" icon="bubble.left.and.text.bubble.right" onClick={askCoach}>
        {display.t('Ask AI Coach', 'ჰკითხე AI ქოუჩს')}
      </Button>
    </Card>
  );
}
