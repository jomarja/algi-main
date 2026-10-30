import { useState } from 'react';
import type { BankAccount } from '../../../shared/bank.ts';
import { Icon, ListItem, ListRow, ListSection, StatusBanner, Tag } from '../../design/index.ts';
import { money } from '../../engine/index.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { bankSourceCopy } from '../onboarding/bankSource.ts';
import { ConnectBankSheet } from '../onboarding/ConnectBankSheet.tsx';
import { ConfirmationSheet } from './ConfirmationSheet.tsx';
import { accountDetail, accountIcon, consentValidUntilText, lastSyncedText } from './settingsModel.ts';

/**
 * "Connected accounts" (SettingsView.swift accountsSection), now backed by TBC Open Banking: the accounts TBC
 * shares, when they last synced, and the consent's end date, with Sync now and Disconnect, or Connect when off.
 */
export function BankAccountsSection() {
  const store = useAppStore();
  const display = useDisplay();
  const [isConnectOpen, setConnectOpen] = useState(false);
  const [isConfirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const { bank } = store.getState();
  const sourceCopy = bankSourceCopy(bank.status?.source);
  const isSyncing = bank.sync === 'loading';

  return (
    <>
      {bank.sync === 'error' && (
        <StatusBanner
          kind="error"
          title={display.t("Couldn't reach TBC Bank", 'TBC ბანკთან დაკავშირება ვერ მოხერხდა')}
          message={display.t('Your last synced data is still here. Try again in a moment.', 'ბოლოს განახლებული მონაცემები ისევ აქ არის. სცადე ცოტა ხანში.')}
        />
      )}
      <ListSection
        header={display.t('Connected accounts', 'დაკავშირებული ანგარიშები')}
        footer={sourceCopy ? display.text(sourceCopy.note) : undefined}
      >
        {store.isBankConnected ? (
          <>
            <BankHeaderRow />
            {(bank.snapshot?.accounts ?? []).map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
            <ListRow
              icon="arrow.clockwise"
              title={isSyncing ? display.t('Syncing…', 'ახლდება…') : display.t('Sync now', 'ახლავე განახლება')}
              onClick={isSyncing ? undefined : () => void store.refreshBank()}
            />
            <ListRow
              icon="xmark.circle.fill"
              title={display.t('Disconnect TBC Bank', 'TBC ბანკის გათიშვა')}
              destructive
              onClick={() => setConfirmingDisconnect(true)}
            />
          </>
        ) : (
          <ListRow
            icon="building.columns"
            title="TBC Bank"
            onClick={() => setConnectOpen(true)}
            trailing={<Tag text={display.t('Not connected', 'არ არის დაკავშირებული')} tone="attention" />}
          />
        )}
      </ListSection>

      <ConnectBankSheet isOpen={isConnectOpen} onClose={() => setConnectOpen(false)} />
      <ConfirmationSheet
        isOpen={isConfirmingDisconnect}
        onClose={() => setConfirmingDisconnect(false)}
        title={display.t('Disconnect TBC Bank?', 'გავთიშოთ TBC ბანკი?')}
        message={display.t(
          'Algi deletes its consent at TBC and forgets the imported bank data. Your goals and manual entries stay.',
          'Algi TBC-ში თანხმობას წაშლის და იმპორტირებულ საბანკო მონაცემებს დაივიწყებს. შენი მიზნები და ხელით შეყვანილი ჩანაწერები დარჩება.',
        )}
        actions={[{ title: display.t('Disconnect', 'გათიშვა'), destructive: true, onConfirm: () => void store.disconnectBank() }]}
      />
    </>
  );
}

/** TBC Bank itself: its data-source tag, last sync, and how long the consent lasts. */
function BankHeaderRow() {
  const store = useAppStore();
  const display = useDisplay();
  const { status } = store.getState().bank;
  const sourceTag = bankSourceCopy(status?.source)?.tag;
  const validUntil = consentValidUntilText(status?.consent ?? null, display);

  return (
    <ListItem>
      <div className="flex items-center gap-3 py-0.5">
        <span className="text-inkSoft">
          <Icon name="building.columns" size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-body text-ink">TBC Bank</span>
          <span className="type-caption text-inkSoft">{lastSyncedText(status?.lastSyncedAt ?? null, store.now, display)}</span>
          {validUntil && (
            <span className="type-caption text-inkSoft">{display.t(`Access valid until ${validUntil}`, `წვდომა მოქმედებს ${validUntil}-მდე`)}</span>
          )}
        </div>
        <Tag text={sourceTag ? display.text(sourceTag) : display.t('Connected', 'დაკავშირებულია')} tone={sourceTag ? 'neutral' : 'positive'} />
      </div>
    </ListItem>
  );
}

function AccountRow({ account }: { account: BankAccount }) {
  const display = useDisplay();
  return (
    <ListItem>
      <div className="flex items-center gap-3 py-0.5">
        <span className="text-inkSoft">
          <Icon name={accountIcon(account.kind)} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-body truncate text-ink">{account.name}</span>
          <span className="type-caption text-inkSoft">{accountDetail(account)}</span>
        </div>
        <span className="type-subheadline shrink-0 font-semibold text-ink">{display.original(money(account.balance, account.currency))}</span>
      </div>
    </ListItem>
  );
}
