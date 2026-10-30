import { useMemo } from 'react';
import { cx, EmptyState, SectionHeader } from '../../design/index.ts';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { recommendationPath } from './recommendations/destinations.ts';
import { FreshFromLukaSection } from './recommendations/FreshFromLukaSection.tsx';
import { SuggestionRow } from './recommendations/SuggestionRow.tsx';
import { useAiRecommendations } from './recommendations/useAiRecommendations.ts';

/**
 * Everything Luka suggests, most useful first (RecommendationsView.swift). With the AI available, his fresh
 * AI suggestions come first and the app's own follow under "From your plan".
 */
export default function RecommendationsScreen({ route }: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const appState = store.getState();
  const recommendations = useMemo(() => store.proactiveCoach(display).recommendations, [store, appState, display]);
  const coachingDataOffText = useMemo(() => store.coachScript(display).coachingDataOff, [store, display]);
  const ai = useAiRecommendations(store);
  const showsAiSection = ai.availability === 'online';

  return (
    <ScreenLayout title={display.text(route.title)}>
      <div className="flex flex-col gap-4">
        <p className="type-callout text-inkSoft">
          {display.t(
            'Each suggestion shows why it matters, the numbers behind it, and one clear next step.',
            'ყველა რჩევა გაჩვენებს, რატომ არის მნიშვნელოვანი, რა რიცხვებს ეფუძნება და ერთ მკაფიო ნაბიჯს.',
          )}
        </p>

        <FreshFromLukaSection ai={ai} coachingDataOffText={coachingDataOffText} />

        {recommendations.length > 0 && (
          <section className={cx('flex flex-col gap-4', showsAiSection && 'pt-4')}>
            {showsAiSection && <SectionHeader title={display.t('From your plan', 'შენი გეგმიდან')} />}
            <ul className="flex flex-col gap-4">
              {recommendations.map((recommendation) => (
                <li key={recommendation.id}>
                  <SuggestionRow
                    pose={recommendation.pose}
                    tone={recommendation.tone}
                    title={recommendation.title}
                    nextStep={recommendation.nextStep}
                    to={recommendationPath({ source: 'local', id: recommendation.id })}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {recommendations.length === 0 && !showsAiSection && (
          <EmptyState
            pose="achievement"
            title={display.t('All done here', 'აქ ყველაფერი მოგვარებულია')}
            message={display.t(
              'Nothing needs your attention right now. Luka will suggest something when it does.',
              'ახლა ყურადღების მიქცევა არაფერს სჭირდება. როცა დასჭირდება, ლუკა გეტყვის.',
            )}
          />
        )}
      </div>
    </ScreenLayout>
  );
}
