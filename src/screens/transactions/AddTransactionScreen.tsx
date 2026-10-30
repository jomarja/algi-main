import { HeaderButton, useToast } from '../../design/index.ts';
import { useRouter, useSearchParams } from '../../layout/router/Router.tsx';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { TransactionForm } from './TransactionForm.tsx';
import { ENTRY_MODE_TITLES, entryModeFromSearch } from './transactionDraft.ts';
import { useTransactionDraft } from './useTransactionDraft.ts';

/** Add a cash transaction, or `?mode=receipt` to enter one from a receipt (AddTransactionSheet.swift as a screen). */
export default function AddTransactionScreen() {
  const display = useDisplay();
  const router = useRouter();
  const toast = useToast();
  const mode = entryModeFromSearch(useSearchParams());
  const { draft, setDraft, today, canSave, save } = useTransactionDraft(mode);
  const close = () => router.back('/transactions');

  const saveAndClose = () => {
    const transaction = save();
    if (!transaction) return;
    toast.show({ kind: 'success', title: display.t('Transaction added', 'ტრანზაქცია დაემატა'), message: transaction.merchant });
    close();
  };

  return (
    <ScreenLayout
      title={display.text(ENTRY_MODE_TITLES[mode])}
      width="narrow"
      leading={<HeaderButton title={display.t('Cancel', 'გაუქმება')} onClick={close} />}
      trailing={<HeaderButton title={display.t('Save', 'შენახვა')} onClick={saveAndClose} isProminent disabled={!canSave} />}
    >
      <TransactionForm mode={mode} draft={draft} onChange={setDraft} today={today} onSubmit={saveAndClose} />
    </ScreenLayout>
  );
}
