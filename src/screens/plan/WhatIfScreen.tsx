import { useState } from 'react';
import { Button, FilterChip, StatusBanner, Tag } from '../../design/index.ts';
import { WhatIfSimulator } from '../../engine/index.ts';
import type { SavingsGoal, WhatIfInputs } from '../../engine/index.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { ChipScroller } from './shared/ChipScroller.tsx';
import { ContentUnavailable } from './shared/ContentUnavailable.tsx';
import { HeaderLink } from './shared/HeaderLink.tsx';
import { SplitColumns } from './shared/SplitColumns.tsx';
import { AssumptionSliders } from './whatIf/AssumptionSliders.tsx';
import { OutcomeTable } from './whatIf/OutcomeTable.tsx';
import { WhatIfVerdict } from './whatIf/WhatIfVerdict.tsx';
import { availablePresets, presetInputs } from './whatIf/whatIfModel.ts';
import type { WhatIfPreset } from './whatIf/whatIfModel.ts';

/**
 * Explore a decision before taking it (WhatIfView.swift): the current plan next to a proposed one. The user's data
 * (income, budget, loan) stays apart from their assumptions (the sliders).
 */
export default function WhatIfScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const goal = store.primaryGoal;
  const hasSavedPlans = store.getState().savedPlans.length > 0;

  return (
    <ScreenLayout
      title={display.t('What if…', 'რა მოხდება, თუ…')}
      width="wide"
      trailing={hasSavedPlans && <HeaderLink to="/plan/saved-plans" title={display.t('Compare', 'შედარება')} />}
    >
      {goal ? (
        <WhatIfExplorer key={goal.id} goal={goal} />
      ) : (
        <ContentUnavailable icon="target" title={display.t('Add a goal first', 'ჯერ დაამატე მიზანი')} />
      )}
    </ScreenLayout>
  );
}

function WhatIfExplorer({ goal }: { goal: SavingsGoal }) {
  const store = useAppStore();
  const display = useDisplay();
  const simulator = new WhatIfSimulator(store.budget, goal, store.currentLoan, store.now);
  const hasLoan = simulator.loan !== null;
  const goalName = display.text(goal.name);
  const [edited, setEdited] = useState<WhatIfInputs | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const inputs = edited ?? simulator.baseline;
  const current = simulator.outcome(simulator.baseline);
  const proposed = simulator.outcome(inputs);

  const presetTitles: Record<WhatIfPreset, string> = {
    delivery: display.t('Spend 50 ₾ less on delivery', 'მიტანაზე 50 ₾-ით ნაკლები'),
    saveMore: display.t(`Save 50 ₾ more for ${goalName}`, `50 ₾-ით მეტი „${goalName}“-სთვის`),
    loan: display.t('Repay the loan faster', 'სესხის სწრაფად დაფარვა'),
    income: display.t('If income drops 10%', 'თუ შემოსავალი 10%-ით შემცირდა'),
  };

  const save = () => {
    const count = store.getState().savedPlans.length + 1;
    const name = display.t(`Plan ${count}`, `გეგმა ${count}`);
    store.savePlan(inputs, proposed, name);
    setSavedName(name);
  };

  return (
    <SplitColumns
      leading={
        <>
          <ChipScroller label={display.t('Ideas to try', 'საცდელი იდეები')}>
            {availablePresets(hasLoan).map((preset) => (
              <FilterChip key={preset} title={presetTitles[preset]} onClick={() => setEdited(presetInputs(preset, simulator.baseline))} />
            ))}
            <FilterChip title={display.t('Reset', 'საწყისი')} icon="arrow.counterclockwise" onClick={() => setEdited(null)} />
          </ChipScroller>
          <AssumptionSliders inputs={inputs} goalName={goalName} hasLoan={hasLoan} onChange={setEdited} />
        </>
      }
      trailing={
        <>
          <OutcomeTable current={current} proposed={proposed} goalName={goalName} hasLoan={hasLoan} />
          <WhatIfVerdict simulator={simulator} inputs={inputs} current={current} proposed={proposed} goalName={goalName} />
          <div className="flex flex-wrap gap-3">
            {/* Long Georgian labels wrap instead of overflowing a phone screen. */}
            <Tag
              text={display.t('From your data: income, budget, loan', 'შენი მონაცემებიდან: შემოსავალი, ბიუჯეტი, სესხი')}
              icon="doc.text"
              className="!shrink !whitespace-normal"
            />
            <Tag
              text={display.t('Your assumptions: sliders', 'შენი დაშვებები: სლაიდერები')}
              tone="estimate"
              icon="slider.horizontal.3"
              className="!shrink !whitespace-normal"
            />
          </div>
          <div className="flex flex-col gap-2">
            {savedName && (
              <StatusBanner
                kind="success"
                title={display.t(`Saved as ${savedName}`, `შენახულია: ${savedName}`)}
                className="animate-page-fade"
              />
            )}
            <Button onClick={save}>{display.t('Save this plan', 'გეგმის შენახვა')}</Button>
          </div>
        </>
      }
    />
  );
}
