import { useMemo } from 'react';
import { ButtonLink, EmptyState } from '../../design/index.ts';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { shownResponse } from './recommendations/aiRecommendationsCache.ts';
import { AiRecommendationDetail } from './recommendations/AiRecommendationDetail.tsx';
import { parseRecommendationParam, RECOMMENDATIONS_PATH } from './recommendations/destinations.ts';
import { LocalRecommendationDetail } from './recommendations/LocalRecommendationDetail.tsx';
import { useAiRecommendationsCache } from './recommendations/useAiRecommendations.ts';

function NotFound({ title, message }: { title: string; message: string }) {
  const display = useDisplay();
  return (
    <EmptyState pose="achievement" title={title} message={message}>
      <ButtonLink kind="secondary" to={RECOMMENDATIONS_PATH}>
        {display.t("See Luka's suggestions", 'ლუკას რჩევების ნახვა')}
      </ButtonLink>
    </EmptyState>
  );
}

function LocalDetail({ id }: { id: string }) {
  const store = useAppStore();
  const display = useDisplay();
  const appState = store.getState();
  const recommendation = useMemo(() => store.proactiveCoach(display).recommendation(id), [store, appState, display, id]);

  if (!recommendation) {
    return (
      <NotFound
        title={display.t('All done here', 'აქ ყველაფერი მოგვარებულია')}
        message={display.t('This suggestion no longer applies.', 'ეს რჩევა აღარ არის აქტუალური.')}
      />
    );
  }
  return <LocalRecommendationDetail recommendation={recommendation} now={store.now} />;
}

/**
 * AI suggestions live in memory for the session, so after a reload (or a language switch) the id may be gone.
 * Nothing is fetched here: a new answer reuses ids, so it could show a different suggestion under this link.
 */
function AiDetail({ id }: { id: string }) {
  const store = useAppStore();
  const display = useDisplay();
  const cache = useAiRecommendationsCache(store);
  const recommendation = cache.find(id);
  const response = shownResponse(cache.snapshot);

  if (!recommendation || !response) {
    return (
      <NotFound
        title={display.t('Suggestion not found', 'რჩევა ვერ მოიძებნა')}
        message={display.t(
          "Luka's AI suggestions are kept only while the app is open. Open the list to see his latest.",
          'ლუკას AI რჩევები მხოლოდ აპის გახსნისას ინახება. გახსენი სია და ნახე უახლესი.',
        )}
      />
    );
  }
  return <AiRecommendationDetail recommendation={recommendation} generatedAt={new Date(response.generatedAt)} />;
}

/** One suggestion in full, either the app's own or one of Luka's AI suggestions (RecommendationDetailView). */
export default function RecommendationDetailScreen({ params, route }: ScreenProps) {
  const display = useDisplay();
  const suggestion = parseRecommendationParam(params.recommendationId ?? '');

  return (
    <ScreenLayout title={display.text(route.title)}>
      {suggestion.source === 'ai' ? <AiDetail id={suggestion.id} /> : <LocalDetail id={suggestion.id} />}
    </ScreenLayout>
  );
}
