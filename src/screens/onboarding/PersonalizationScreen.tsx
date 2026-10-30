import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button, ChoiceCard, CurrencyPicker, Icon, LanguageSwitcher, TextField } from '../../design/index.ts';
import {
  CURRENCY_SYMBOLS,
  FINANCIAL_OBJECTIVES,
  majorUnits,
  OBJECTIVE_META,
  parseSavingsTarget,
  type FinancialObjective,
} from '../../engine/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { OnboardingLayout, OnboardingTopBar, StepHeader } from './OnboardingChrome.tsx';

const formId = 'personalization-form';

/** Step 1 of 3: only the essentials — language, display currency, main objective, optional target (PersonalizationView). */
export default function PersonalizationScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const { language, displayCurrency, objective, savingsTarget } = store.getState();
  const [targetText, setTargetText] = useState(() => (savingsTarget ? String(Math.trunc(majorUnits(savingsTarget))) : ''));

  const saveAndContinue = (event: FormEvent) => {
    event.preventDefault();
    store.setSavingsTarget(parseSavingsTarget(targetText));
    router.navigate('/onboarding/personal-info');
  };

  return (
    <OnboardingLayout
      spacing="l"
      topBar={<OnboardingTopBar step={1} onBack={() => router.back('/welcome')} />}
      actions={
        <Button type="submit" form={formId} trailingIcon="arrow.right">
          {display.t('Continue', 'გაგრძელება')}
        </Button>
      }
    >
      <StepHeader
        className="pt-2"
        overline={display.t('Make Algi yours', 'მოირგე Algi')}
        title={display.t('What matters most right now?', 'რა არის ახლა ყველაზე მნიშვნელოვანი?')}
        message={display.t(
          "We'll tailor your weekly plan and guidance around this.",
          'ამის მიხედვით მოვარგებთ შენს კვირის გეგმას და რჩევებს.',
        )}
      />

      <form id={formId} noValidate onSubmit={saveAndContinue} className="flex flex-col gap-5">
        <Labeled title={display.t('Language', 'ენა')}>
          <LanguageSwitcher value={language} onChange={(next) => store.setLanguage(next)} />
        </Labeled>

        <Labeled title={display.t('Display currency', 'საჩვენებელი ვალუტა')}>
          <CurrencyPicker value={displayCurrency} onChange={(next) => store.setDisplayCurrency(next)} />
        </Labeled>

        <fieldset className="flex flex-col gap-2">
          <legend className="type-footnote mb-2 font-semibold text-inkSoft">{display.t('Your main goal', 'შენი მთავარი მიზანი')}</legend>
          <div className="grid grid-cols-2 gap-3">
            {FINANCIAL_OBJECTIVES.map((option) => (
              <ObjectiveCard
                key={option}
                objective={option}
                isSelected={option === objective}
                onSelect={() => store.setObjective(option)}
              />
            ))}
          </div>
        </fieldset>

        <TextField
          label={display.t('Savings target (optional)', 'დანაზოგის მიზანი (არასავალდებულო)')}
          prefix={CURRENCY_SYMBOLS.GEL}
          value={targetText}
          onChange={(event) => setTargetText(event.target.value)}
          placeholder="5000"
          inputMode="numeric"
          enterKeyHint="next"
          autoComplete="off"
        />
      </form>
    </OnboardingLayout>
  );
}

/** A visible caption over a picker; the picker carries the same accessible name itself. */
function Labeled({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden className="type-footnote font-semibold text-inkSoft">
        {title}
      </p>
      {children}
    </div>
  );
}

interface ObjectiveCardProps {
  objective: FinancialObjective;
  isSelected: boolean;
  onSelect: () => void;
}

function ObjectiveCard({ objective, isSelected, onSelect }: ObjectiveCardProps) {
  const display = useDisplay();
  const meta = OBJECTIVE_META[objective];
  return (
    <ChoiceCard isSelected={isSelected} onClick={onSelect}>
      <span className="flex min-h-[96px] flex-col items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-mintPale text-mintDark">
          <Icon name={meta.icon} size={16} />
        </span>
        <span className="type-subheadline font-semibold text-ink">{display.text(meta.title)}</span>
      </span>
    </ChoiceCard>
  );
}
