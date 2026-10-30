import { useId } from 'react';
import { Icon, IllustrationStage, Tag } from '../../../design/index.ts';
import { Link } from '../../../layout/router/Link.tsx';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { RECOMMENDATIONS_PATH } from '../recommendations/destinations.ts';

/** The welcome above the first message (CoachView's hero): Luka, a privacy note, and his suggestions. */
export function CoachHero({ suggestionCount }: { suggestionCount: number }) {
  const display = useDisplay();
  const titleId = useId();
  return (
    <section className="flex flex-col gap-3" aria-labelledby={titleId}>
      <h2 id={titleId} className="type-title text-ink">
        {display.t('Ask Luka', 'ჰკითხე ლუკას')}
      </h2>
      <p className="type-callout text-inkSoft">{display.t('Private guidance, just for you.', 'პირადი რჩევები მხოლოდ შენთვის.')}</p>
      <div className="relative overflow-hidden rounded-xl">
        <IllustrationStage pose="assistant" height={200} />
        <Tag text={display.t('Private & ready', 'პირადი და მზადაა')} tone="positive" icon="lock.fill" className="absolute right-3 top-3" />
      </div>
      <Link
        to={RECOMMENDATIONS_PATH}
        className="type-subheadline pressable flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-amberPale px-4 font-semibold text-ink"
      >
        <Icon name="sparkles" size={16} />
        {display.t(`Luka has ${suggestionCount} suggestions for you`, `ლუკას შენთვის ${suggestionCount} რჩევა აქვს`)}
      </Link>
    </section>
  );
}
