import { useMemo, useState } from 'react';
import { Button, Card, Sheet } from '../../design/index.ts';
import type { SavingsGoal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { GoalForm } from './GoalForm.tsx';
import { editedGoal, goalDraftFrom } from './goalDraft.ts';

interface EditGoalSheetProps {
  goal: SavingsGoal;
  isOpen: boolean;
  now: Date;
  onClose: () => void;
  onSave: (goal: SavingsGoal) => void;
  onRemove: () => void;
}

/**
 * Edits a goal with the same form that creates one, and removes it after a confirmation.
 * Mount it with a new `key` each time it opens, so the form starts from the goal as it is now.
 */
export function EditGoalSheet({ goal, isOpen, now, onClose, onSave, onRemove }: EditGoalSheetProps) {
  const display = useDisplay();
  const [fields, setFields] = useState(() => goalDraftFrom(goal, display));
  const edited = useMemo(() => editedGoal(goal, fields, display), [goal, fields, display]);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.t('Edit goal', 'მიზნის რედაქტირება')}
      detent="large"
      leadingAction={{ title: display.t('Cancel', 'გაუქმება'), onClick: onClose }}
      trailingAction={{ title: display.t('Save', 'შენახვა'), onClick: () => edited && onSave(edited), disabled: !edited }}
    >
      <div className="flex flex-col gap-6 pt-2">
        <GoalForm fields={fields} onChange={setFields} draft={edited} now={now} />
        <RemoveGoal name={display.text(goal.name)} onRemove={onRemove} />
      </div>
    </Sheet>
  );
}

/** "Remove goal", then an explicit confirmation before anything is deleted. */
function RemoveGoal({ name, onRemove }: { name: string; onRemove: () => void }) {
  const display = useDisplay();
  const [isConfirming, setConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <Button kind="destructive" onClick={() => setConfirming(true)}>
        {display.t('Remove goal', 'მიზნის წაშლა')}
      </Button>
    );
  }

  return (
    <Card role="alertdialog" aria-label={display.t('Remove this goal?', 'წავშალოთ ეს მიზანი?')} className="flex animate-page-fade flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="type-headline text-ink">{display.t('Remove this goal?', 'წავშალოთ ეს მიზანი?')}</p>
        <p className="type-footnote text-inkSoft">
          {display.t(`${name} and its progress will be removed from your journey.`, `„${name}“ და მისი პროგრესი გზიდან წაიშლება.`)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button kind="secondary" autoFocus onClick={() => setConfirming(false)}>
          {display.t('Keep it', 'დატოვება')}
        </Button>
        <Button kind="destructive" onClick={onRemove}>
          {display.t('Remove', 'წაშლა')}
        </Button>
      </div>
    </Card>
  );
}
