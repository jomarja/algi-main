import { useId } from 'react';
import type { FormEvent } from 'react';
import { ButtonLink, FilterChip, Icon, StatusBanner } from '../../../design/index.ts';
import { goalExamples } from '../../../engine/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';
import { ChipScroller } from '../shared/ChipScroller.tsx';

interface GoalComposerProps {
  text: string;
  onTextChange: (text: string) => void;
  /** Reads the sentence (or a tapped example) and plans it. */
  onSubmit: (text: string) => void;
  hasParseFailed: boolean;
}

/** "What are you saving for?": a goal in the user's own words, with example sentences to start from. */
export function GoalComposer({ text, onTextChange, onSubmit, hasParseFailed }: GoalComposerProps) {
  const display = useDisplay();
  const headingId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(text);
  };

  const pickExample = (example: string) => {
    onTextChange(example);
    onSubmit(example);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="type-title2 text-ink">
        {display.t('What are you saving for?', 'რისთვის ზოგავ?')}
      </h2>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={display.t('I want to buy a car worth 15,000 ₾', 'მინდა ვიყიდო მანქანა 15 000 ₾-ად')}
          aria-labelledby={headingId}
          enterKeyHint="go"
          autoComplete="off"
          className="type-body min-h-[50px] min-w-0 flex-1 rounded-md bg-surface px-4 text-ink ring-1 ring-inset ring-line transition-shadow placeholder:text-inkMuted focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        />
        <button
          type="submit"
          aria-label={display.t('Plan it', 'დაგეგმე')}
          className="pressable flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md bg-ink text-white"
        >
          <Icon name="sparkles" size={18} />
        </button>
      </form>
      <ChipScroller label={display.t('Examples', 'მაგალითები')}>
        {goalExamples(display).map((example) => (
          <FilterChip key={example} title={example} onClick={() => pickExample(example)} />
        ))}
      </ChipScroller>
      {hasParseFailed && (
        <StatusBanner
          kind="info"
          title={display.t('Add an amount', 'დაამატე თანხა')}
          message={display.t('For example: “Holiday in Batumi, 1,500 ₾ in 5 months”.', 'მაგალითად: „დასვენება ბათუმში, 1 500 ₾ 5 თვეში“.')}
          className="animate-page-fade"
        />
      )}
      <ButtonLink kind="tertiary" to="/goals/new" className="self-start">
        {display.t('Or set it up manually', 'ან შექმენი ხელით')}
      </ButtonLink>
    </section>
  );
}
