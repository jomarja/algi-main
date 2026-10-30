import { useEffect, useState } from 'react';
import { Button, FilterChip, Sheet } from '../../design/index.ts';
import { gel, moneyEquals } from '../../engine/index.ts';
import type { Money, SavingsGoal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

const PRESETS: readonly Money[] = [gel(50), gel(100), gel(200), gel(450)];
const DEFAULT_AMOUNT = gel(100);

interface AddMoneySheetProps {
  goal: SavingsGoal;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (amount: Money) => void;
}

/** Puts money toward a goal (GoalDetailView.swift `AddMoneySheet`); app-side only, nothing moves at the bank. */
export function AddMoneySheet({ goal, isOpen, onClose, onAdd }: AddMoneySheetProps) {
  const display = useDisplay();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const name = display.text(goal.name);

  useEffect(() => {
    if (isOpen) setAmount(DEFAULT_AMOUNT);
  }, [isOpen]);

  const add = () => {
    onAdd(amount);
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.t('Add money', 'თანხის დამატება')}
      leadingAction={{ title: display.t('Cancel', 'გაუქმება'), onClick: onClose }}
      footer={<Button onClick={add}>{display.t(`Add to ${name}`, `დამატება: ${name}`)}</Button>}
    >
      <div className="flex flex-col items-center gap-5 py-5">
        <p key={amount.minorUnits} aria-live="polite" className="type-display animate-page-fade text-ink">
          {display.money(amount, { precision: 'whole' })}
        </p>
        <div role="group" aria-label={display.t('Amount', 'თანხა')} className="flex flex-wrap justify-center gap-2">
          {PRESETS.map((preset) => (
            <FilterChip
              key={preset.minorUnits}
              title={display.money(preset, { precision: 'whole' })}
              isSelected={moneyEquals(preset, amount)}
              onClick={() => setAmount(preset)}
            />
          ))}
        </div>
        <p className="type-caption text-center text-inkMuted">
          {display.t(
            'Moves money into your goal in this prototype only — no real transfer happens.',
            'პროტოტიპში თანხა მხოლოდ მიზანზე აისახება — რეალური გადარიცხვა არ ხდება.',
          )}
        </p>
      </div>
    </Sheet>
  );
}
