import { Card, EmptyState, SectionHeader } from '../../design/index.ts';
import { DashboardColumns, ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { CardLink } from '../plan/shared/CardLink.tsx';
import { Intro } from '../plan/shared/Intro.tsx';
import { CategoryBreakdown } from './CategoryBreakdown.tsx';
import { InsightRow } from './InsightRow.tsx';
import { noticedInsights } from './insightsModel.ts';
import { MonthSummaryCard } from './MonthSummaryCard.tsx';

/** Explains behaviour rather than just charting it (InsightsView.swift): the month at a glance, then what Luka noticed. */
export default function InsightsScreen() {
  const store = useAppStore();
  const display = useDisplay();

  return (
    <ScreenLayout title={display.t('Insights', 'ანალიზი')} titleDisplay="large" width="wide">
      <Intro>{display.t('Understand what changed and why.', 'გაიგე, რა შეიცვალა და რატომ.')}</Intro>
      {store.hasFinancialData ? (
        <InsightsOverview />
      ) : (
        <Card>
          <EmptyState
            pose="overview"
            title={display.t('Nothing to analyze yet', 'ჯერ გასაანალიზებელი არაფერია')}
            message={display.t(
              'Insights appear after a few transactions. Add one from Home or explore with sample data.',
              'ანალიზი რამდენიმე ტრანზაქციის შემდეგ გამოჩნდება. დაამატე მთავარი გვერდიდან ან დაათვალიერე სანიმუშო მონაცემებით.',
            )}
          />
        </Card>
      )}
    </ScreenLayout>
  );
}

function InsightsOverview() {
  const store = useAppStore();
  const display = useDisplay();
  const finance = store.finance;
  const insights = noticedInsights(store.insights(display));

  return (
    <DashboardColumns
      main={
        <>
          <MonthSummaryCard finance={finance} previousMonthSpending={store.history.previousMonthSpending} />
          {insights.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader title={display.t('What Luka noticed', 'რა შენიშნა ლუკამ')} />
              <ul className="flex flex-col gap-3">
                {insights.map((content) => (
                  <li key={content.kind}>
                    <InsightRow content={content} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      }
      aside={
        <>
          <CategoryBreakdown totals={finance.categoryTotals(finance.currentMonth)} />
          <CardLink to="/transactions" icon="list.bullet" title={display.t('All transactions', 'ყველა ტრანზაქცია')} />
        </>
      }
    />
  );
}
