import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Icon, useMediaQuery, wideQuery } from '../../design/index.ts';
import type { CoachQuestion, FinanceTransaction } from '../../engine/index.ts';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { CoachHeader } from './chat/CoachHeader.tsx';
import { CoachHero } from './chat/CoachHero.tsx';
import { CoachSidePanel } from './chat/CoachSidePanel.tsx';
import { Composer, type SuggestedQuestion } from './chat/Composer.tsx';
import { hasConversationStarted } from './chat/conversation.ts';
import { MessageList } from './chat/MessageList.tsx';
import { SupportingTransactionsSheet } from './chat/SupportingTransactionsSheet.tsx';
import { useCoachChat } from './chat/useCoachChat.ts';
import { useEscapeKey } from './chat/useEscapeKey.ts';
import { useStickToBottom } from './chat/useStickToBottom.ts';
import { useAiAvailability } from './shared/useAiAvailability.ts';
import { useEntranceAnimation } from './shared/useEntranceAnimation.ts';

const SidePanel = memo(CoachSidePanel);

interface SheetState {
  readonly isOpen: boolean;
  readonly transactions: readonly FinanceTransaction[];
}

function JumpToLatestButton({ onClick }: { onClick(): void }) {
  const display = useDisplay();
  const ref = useRef<HTMLButtonElement>(null);
  useEntranceAnimation(ref, true);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={display.t('Jump to the latest message', 'ბოლო შეტყობინებაზე გადასვლა')}
      className="pressable absolute inset-x-0 -top-12 mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md"
    >
      <Icon name="arrow.down" size={18} />
    </button>
  );
}

/**
 * The AI Coach tab (CoachView.swift): Luka's hero and greeting, the conversation, suggested questions and the
 * composer pinned at the bottom. From the wide breakpoint, a side panel holds the suggestions and key figures.
 */
export default function CoachScreen(_props: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const appState = store.getState();
  // Rebuilt when the store or the language changes, not on every streamed frame, so scripted bubbles stay memoised.
  const script = useMemo(() => store.coachScript(display), [store, appState, display]);
  const recommendations = useMemo(() => store.proactiveCoach(display).recommendations, [store, appState, display]);
  const chat = useCoachChat(store, script);
  const availability = useAiAvailability();
  const isWide = useMediaQuery(wideQuery);
  const contentRef = useRef<HTMLDivElement>(null);
  const scroll = useStickToBottom(contentRef);
  const [sheet, setSheet] = useState<SheetState>({ isOpen: false, transactions: [] });
  const hasStarted = hasConversationStarted(chat.state);

  useEscapeKey(chat.isStreaming, chat.stop);

  const suggestions = useMemo<SuggestedQuestion[]>(
    () => chat.suggestions.map((question) => ({ question, title: script.prompt(question) })),
    [chat.suggestions, script],
  );

  const { ask: askChat, send: sendChat } = chat;
  const { follow } = scroll;
  const ask = useCallback(
    (question: CoachQuestion) => {
      follow();
      askChat(question);
    },
    [askChat, follow],
  );
  const send = useCallback(
    (text: string) => {
      const isSent = sendChat(text);
      if (isSent) follow();
      return isSent;
    },
    [sendChat, follow],
  );
  const showTransactions = useCallback((transactions: readonly FinanceTransaction[]) => {
    setSheet({ isOpen: true, transactions });
  }, []);
  const closeSheet = useCallback(() => setSheet((current) => ({ ...current, isOpen: false })), []);

  const subtitle = useMemo(() => {
    const period = `${display.date(store.finance.currentMonth.start, 'dayMonth')} – ${display.date(store.now, 'dayMonth')}`;
    const { status } = appState.bank;
    const isSampleData = status?.connected === true && status.source !== 'tbc-production';
    return isSampleData
      ? display.t(`Analyzing ${period} · sample data`, `ანალიზი: ${period} · ნიმუში`)
      : display.t(`Analyzing ${period}`, `ანალიზი: ${period}`);
  }, [store, appState, display]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--tab-bar-height)-var(--safe-bottom))] w-full max-w-[1120px] flex-col md:min-h-dvh">
      <CoachHeader subtitle={subtitle} />
      <div className="flex flex-1 flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="mx-auto flex w-full min-w-0 max-w-[720px] flex-1 flex-col">
          <div
            ref={contentRef}
            aria-label={display.t('Conversation with Luka', 'საუბარი ლუკასთან')}
            role="region"
            className="flex flex-1 flex-col gap-4 px-5 py-4 md:px-8"
          >
            {!hasStarted && <CoachHero suggestionCount={recommendations.length} />}
            <MessageList state={chat.state} script={script} onShowTransactions={showTransactions} />
          </div>
          <div className="sticky bottom-[calc(var(--tab-bar-height)+var(--safe-bottom))] z-10 bg-paper/95 md:bottom-0">
            {hasStarted && !scroll.isAtBottom && <JumpToLatestButton onClick={scroll.scrollToLatest} />}
            <Composer
              suggestions={suggestions}
              isBusy={chat.isBusy}
              isStreaming={chat.isStreaming}
              isOffline={availability === 'offline'}
              freeAnswersLeft={appState.plan === 'free' ? store.remainingFreeAIRecommendations : null}
              onAsk={ask}
              onSend={send}
              onStop={chat.stop}
            />
          </div>
        </div>
        {isWide && (
          <aside
            aria-label={display.t('Suggestions and your numbers', 'რჩევები და შენი რიცხვები')}
            className="scrollbar-none sticky top-[calc(var(--safe-top)+52px)] max-h-[calc(100dvh-var(--safe-top)-52px)] self-start overflow-y-auto py-4 pr-8"
          >
            <SidePanel suggestions={suggestions} isBusy={chat.isBusy} onAsk={ask} recommendations={recommendations} />
          </aside>
        )}
      </div>
      <SupportingTransactionsSheet isOpen={sheet.isOpen} transactions={sheet.transactions} now={store.now} onClose={closeSheet} />
    </div>
  );
}
