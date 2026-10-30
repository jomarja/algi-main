import { useState } from 'react';
import { Button, Card, Icon, StatusBanner, Tag } from '../../design/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { PressableCard } from '../home/PressableCard.tsx';
import { AddTransactionSheet } from '../transactions/AddTransactionSheet.tsx';
import type { EntryMode } from '../transactions/transactionDraft.ts';
import { bankSourceCopy } from './bankSource.ts';
import { ConnectBankSheet } from './ConnectBankSheet.tsx';
import { OnboardingLayout, OnboardingTopBar, StepHeader } from './OnboardingChrome.tsx';

/**
 * Step 3 of 3: an optional TBC Bank connection, with manual entry as a first-class alternative
 * (BankConnectionView). Connecting leaves for TBC's consent page and comes back here.
 */
export default function BankConnectionScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const [isConsentOpen, setConsentOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');
  const [isEntryOpen, setEntryOpen] = useState(false);
  const { bank } = store.getState();
  const isConnected = store.isBankConnected;
  const sourceCopy = bankSourceCopy(bank.status?.source);

  const finish = () => {
    store.completeOnboarding();
    router.navigate('/', { replace: true });
  };

  const openEntry = (mode: EntryMode) => {
    setEntryMode(mode);
    setEntryOpen(true);
  };

  return (
    <OnboardingLayout
      topBar={<OnboardingTopBar step={3} onBack={() => router.back('/onboarding/personal-info')} />}
      actions={
        <>
          {isConnected ? (
            <Button trailingIcon="arrow.right" onClick={finish}>
              {display.t('Continue', 'გაგრძელება')}
            </Button>
          ) : (
            <Button icon="building.columns" onClick={() => setConsentOpen(true)}>
              {display.t('Connect TBC Bank', 'TBC ბანკის დაკავშირება')}
            </Button>
          )}
          {!isConnected && (
            <Button kind="tertiary" className="self-center" onClick={finish}>
              {display.t('Do this later', 'მოგვიანებით')}
            </Button>
          )}
        </>
      }
    >
      <StepHeader
        className="pt-2"
        overline={display.t('Optional connection', 'არასავალდებულო კავშირი')}
        title={display.t('Bring your money into focus.', 'შენი ფული ერთ სივრცეში.')}
        message={display.t(
          'Connect TBC Bank, or add your spending yourself.',
          'დააკავშირე TBC ბანკი, ან ხარჯები თავად დაამატე.',
        )}
      />

      {bank.sync === 'error' && (
        <StatusBanner
          kind="error"
          title={display.t("Couldn't reach TBC Bank", 'TBC ბანკთან დაკავშირება ვერ მოხერხდა')}
          message={display.t('Check your connection and try again.', 'შეამოწმე ინტერნეტი და სცადე თავიდან.')}
        />
      )}
      {isConnected && (
        <StatusBanner
          kind="success"
          title={display.t('TBC Bank connected', 'TBC ბანკი დაკავშირებულია')}
          message={display.t("Your balances and transactions are ready. Let's go!", 'შენი ბალანსები და ტრანზაქციები მზადაა. წავედით!')}
        />
      )}

      <ControlCard />

      <PressableCard onClick={() => (isConnected ? finish() : setConsentOpen(true))} className="items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-lavender font-rounded text-[18px] font-extrabold text-white">
          T
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="type-body font-semibold text-ink">TBC Bank</span>
            {sourceCopy?.tag && <Tag text={display.text(sourceCopy.tag)} tone="estimate" icon="flask" />}
          </span>
          <span className="type-footnote text-inkSoft">
            {isConnected
              ? display.t('Connected · read-only', 'დაკავშირებულია · მხოლოდ ნახვა')
              : display.t('Open Banking · read-only', 'ღია ბანკინგი · მხოლოდ ნახვა')}
          </span>
        </span>
        <span aria-hidden className={isConnected ? 'text-mint' : 'text-inkMuted'}>
          <Icon name={isConnected ? 'checkmark.circle.fill' : 'chevron.right'} size={isConnected ? 22 : 14} />
        </span>
      </PressableCard>

      {sourceCopy && <p className="type-caption text-inkMuted">{display.text(sourceCopy.note)}</p>}

      <div className="grid grid-cols-2 gap-3">
        <AlternativeTile
          title={display.t('Import receipt', 'ქვითრის იმპორტი')}
          icon="doc.text.viewfinder"
          onClick={() => openEntry('receipt')}
        />
        <AlternativeTile title={display.t('Add manually', 'ხელით დამატება')} icon="plus" onClick={() => openEntry('manual')} />
      </div>

      <ConnectBankSheet isOpen={isConsentOpen} onClose={() => setConsentOpen(false)} />
      {/* As in iOS, saving a first transaction finishes onboarding without a bank. */}
      <AddTransactionSheet isOpen={isEntryOpen} mode={entryMode} onClose={() => setEntryOpen(false)} onSaved={finish} />
    </OnboardingLayout>
  );
}

function ControlCard() {
  const display = useDisplay();
  return (
    <Card background="mintPale" bordered={false} className="flex items-start gap-3">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-mintDark text-white">
        <Icon name="lock.shield.fill" size={16} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="type-subheadline font-bold text-ink">{display.t('You stay in control', 'კონტროლი შენს ხელშია')}</span>
        <span className="type-footnote text-inkSoft">
          {display.t(
            "Algi receives read-only balances and transactions. It can't move money or make payments.",
            'Algi მიიღებს მხოლოდ ბალანსებსა და ტრანზაქციებს სანახავად. ის ვერ გადარიცხავს ფულს და ვერ გადაიხდის.',
          )}
        </span>
      </span>
    </Card>
  );
}

interface AlternativeTileProps {
  title: string;
  icon: string;
  onClick: () => void;
}

function AlternativeTile({ title, icon, onClick }: AlternativeTileProps) {
  return (
    <PressableCard onClick={onClick} className="h-full items-center gap-2">
      <span aria-hidden className="text-inkSoft">
        <Icon name={icon} size={18} />
      </span>
      <span className="type-subheadline line-clamp-2 font-semibold text-ink">{title}</span>
    </PressableCard>
  );
}
