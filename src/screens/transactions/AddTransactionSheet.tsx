import { useEffect } from 'react';
import { Sheet } from '../../design/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { TransactionForm } from './TransactionForm.tsx';
import { ENTRY_MODE_TITLES } from './transactionDraft.ts';
import type { EntryMode } from './transactionDraft.ts';
import { useTransactionDraft } from './useTransactionDraft.ts';

interface AddTransactionSheetProps {
  isOpen: boolean;
  mode: EntryMode;
  onClose: () => void;
  /** Called after the transaction is recorded. */
  onSaved: () => void;
}

/** The add-transaction form presented over the current screen (AddTransactionSheet.swift), e.g. during onboarding. */
export function AddTransactionSheet({ isOpen, mode, onClose, onSaved }: AddTransactionSheetProps) {
  const display = useDisplay();
  const { draft, setDraft, today, canSave, save, reset } = useTransactionDraft(mode);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const saveAndClose = () => {
    if (!save()) return;
    onClose();
    onSaved();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.text(ENTRY_MODE_TITLES[mode])}
      detent="large"
      leadingAction={{ title: display.t('Cancel', 'გაუქმება'), onClick: onClose }}
      trailingAction={{ title: display.t('Save', 'შენახვა'), onClick: saveAndClose, disabled: !canSave }}
    >
      <div className="pt-2">
        <TransactionForm mode={mode} draft={draft} onChange={setDraft} today={today} onSubmit={saveAndClose} />
      </div>
    </Sheet>
  );
}
