import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { cx, FilterChip, Icon } from '../../../design/index.ts';
import { FREE_MONTHLY_AI_RECOMMENDATIONS, type CoachQuestion } from '../../../engine/index.ts';
import { Link } from '../../../layout/router/Link.tsx';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { COUNTER_FROM_CHARS, formatCount, MAX_MESSAGE_CHARS } from './messageLimit.ts';

export interface SuggestedQuestion {
  readonly question: CoachQuestion;
  readonly title: string;
}

interface ComposerProps {
  suggestions: readonly SuggestedQuestion[];
  isBusy: boolean;
  isStreaming: boolean;
  isOffline: boolean;
  /** Personalised answers left this month on the free plan; null on Premium. */
  freeAnswersLeft: number | null;
  onAsk(question: CoachQuestion): void;
  /** False when the question couldn't be sent, so the draft stays. */
  onSend(text: string): boolean;
  onStop(): void;
}

/** Five lines of body text plus padding, then the field scrolls. */
const maxFieldHeight = 5 * 22 + 24;

/**
 * The bottom of the chat (CoachView's composer): suggested questions, the free plan's remaining answers, and the
 * message field with Send, which turns into Stop while Luka writes. Enter sends, Shift+Enter adds a line.
 */
export function Composer({ suggestions, isBusy, isStreaming, isOffline, freeAnswersLeft, onAsk, onSend, onStop }: ComposerProps) {
  const display = useDisplay();
  const [draft, setDraft] = useState('');
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const hintId = useId();
  const counterId = useId();
  const canSend = draft.trim() !== '' && !isBusy;
  const showsCounter = draft.length >= COUNTER_FROM_CHARS;

  // Grows with the text up to five lines, like a messaging field.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, maxFieldHeight)}px`;
  }, [draft]);

  const send = () => {
    if (!canSend || !onSend(draft)) return;
    setDraft('');
    // Send is disabled while Luka answers, which would drop its focus; the field keeps it (and the keyboard) instead.
    fieldRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isStreaming) onStop();
    else send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <div className="flex flex-col gap-3 py-3">
      {!isBusy && suggestions.length > 0 && (
        <div
          role="group"
          aria-label={display.t('Suggested questions', 'შემოთავაზებული კითხვები')}
          className="scrollbar-none flex gap-2 overflow-x-auto px-5 md:px-8 xl:hidden"
        >
          {suggestions.map((suggestion) => (
            <FilterChip key={suggestion.question} title={suggestion.title} onClick={() => onAsk(suggestion.question)} />
          ))}
        </div>
      )}

      {freeAnswersLeft !== null && (
        <Link
          to="/paywall"
          className="type-caption pressable-dim inline-flex items-center justify-center gap-1 self-center px-5 font-semibold text-inkSoft"
        >
          <Icon name="sparkles" size={12} />
          {display.t(
            `${freeAnswersLeft} of ${FREE_MONTHLY_AI_RECOMMENDATIONS} free personalized answers left this month`,
            `ამ თვეში დარჩა ${freeAnswersLeft} / ${FREE_MONTHLY_AI_RECOMMENDATIONS} უფასო პერსონალური პასუხი`,
          )}
        </Link>
      )}

      {isOffline && (
        <p className="type-caption flex items-center justify-center gap-1 px-5 text-center text-inkMuted">
          <Icon name="info.circle" size={12} />
          {display.t(
            'Luka is offline right now — the suggested questions still use your data.',
            'ლუკა ახლა ოფლაინშია — შემოთავაზებული კითხვები მაინც შენს მონაცემებს იყენებს.',
          )}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 px-5 md:px-8">
        <label className="sr-only" htmlFor={fieldId}>
          {display.t('Message to Luka', 'შეტყობინება ლუკას')}
        </label>
        <textarea
          ref={fieldRef}
          id={fieldId}
          rows={1}
          value={draft}
          maxLength={MAX_MESSAGE_CHARS}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          enterKeyHint="send"
          placeholder={display.t('Ask anything about your money…', 'იკითხე ნებისმიერი რამ შენს ფინანსებზე…')}
          aria-describedby={showsCounter ? `${hintId} ${counterId}` : hintId}
          className="type-body block max-h-[134px] min-h-[48px] min-w-0 flex-1 resize-none overflow-y-auto rounded-md bg-surface px-4 py-3 text-ink outline-none ring-1 ring-inset ring-line transition-shadow placeholder:text-inkMuted focus:ring-2 focus:ring-mint"
        />
        <button
          type="submit"
          disabled={!isStreaming && !canSend}
          aria-label={isStreaming ? display.t('Stop the answer', 'პასუხის შეჩერება') : display.t('Send', 'გაგზავნა')}
          className={cx(
            'pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-white transition-[background-color,opacity] duration-200 disabled:opacity-40',
            isStreaming ? 'bg-ink' : 'bg-mint',
          )}
        >
          {isStreaming ? <span aria-hidden className="h-3.5 w-3.5 rounded-[3px] bg-current" /> : <Icon name="paperplane.fill" size={18} />}
        </button>
      </form>
      <span id={hintId} className="sr-only">
        {display.t('Press Enter to send, Shift and Enter for a new line.', 'გასაგზავნად დააჭირე Enter-ს, ახალი ხაზისთვის — Shift-სა და Enter-ს.')}
      </span>
      {showsCounter && (
        <p
          id={counterId}
          className={cx(
            'type-caption -mt-2 px-5 text-right tabular-nums md:px-8',
            draft.length >= MAX_MESSAGE_CHARS ? 'text-coralDeep' : 'text-inkSoft',
          )}
        >
          {`${formatCount(draft.length, display.language)} / ${formatCount(MAX_MESSAGE_CHARS, display.language)}`}
        </p>
      )}
    </div>
  );
}
