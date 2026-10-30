import { useState } from 'react';
import { redirectToBankConsent } from '../../api/bankConsent.ts';
import { Button, Card, Icon, palette, Sheet, StatusBanner } from '../../design/index.ts';
import type { PaletteToken } from '../../design/index.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { bankSourceCopy } from './bankSource.ts';

interface ConnectBankSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Explains exactly what connecting TBC Bank shares (ConsentSheet.swift), then starts the PSD2 consent and
 * leaves for TBC's page. The bank sends the user back to the screen they started from.
 */
export function ConnectBankSheet({ isOpen, onClose }: ConnectBankSheetProps) {
  const store = useAppStore();
  const display = useDisplay();
  const [isConnecting, setConnecting] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const copy = bankSourceCopy(store.getState().bank.status?.source);

  const close = () => {
    setFailed(false);
    onClose();
  };

  const connect = async () => {
    setConnecting(true);
    setFailed(false);
    try {
      redirectToBankConsent(await store.connectBank());
      // The page is leaving for the bank; keep the spinner until it does.
    } catch {
      setFailed(true);
      setConnecting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={close}
      title={display.t('Connect TBC Bank', 'TBC ბანკის დაკავშირება')}
      detent="large"
      dismissible={!isConnecting}
      footer={
        <div className="flex flex-col gap-2">
          <Button isLoading={isConnecting} onClick={() => void connect()}>
            {isConnecting
              ? display.t('Opening TBC Bank…', 'იხსნება TBC ბანკი…')
              : display.t('Continue to TBC Bank', 'გაგრძელება TBC ბანკში')}
          </Button>
          <Button kind="tertiary" disabled={isConnecting} onClick={close}>
            {display.t('Not now', 'ახლა არა')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        {hasFailed && (
          <StatusBanner
            kind="error"
            title={display.t("Couldn't reach TBC Bank", 'TBC ბანკთან დაკავშირება ვერ მოხერხდა')}
            message={display.t('Nothing was shared. Please try again in a moment.', 'არაფერი გაზიარებულა. სცადე თავიდან ცოტა ხანში.')}
          />
        )}
        {copy && <StatusBanner kind="info" title={display.text(copy.consentTitle)} message={display.text(copy.consentMessage)} />}

        <ConsentSection
          title={display.t('What Algi receives', 'რას მიიღებს Algi')}
          symbol="checkmark.circle.fill"
          tint="mint"
          items={[
            display.t('Account balances', 'ანგარიშების ბალანსები'),
            display.t('Your recent transactions', 'შენი ბოლო ტრანზაქციები'),
            display.t('Loan balances and monthly payments', 'სესხების ნაშთი და თვიური გადასახადები'),
          ]}
        />
        <ConsentSection
          title={display.t('What Algi can never do', 'რას ვერასდროს გააკეთებს Algi')}
          symbol="xmark.circle.fill"
          tint="coral"
          items={[
            display.t('Move money or make payments', 'ფულის გადარიცხვა ან გადახდა'),
            display.t('See your online banking password', 'შენი ინტერნეტბანკის პაროლის ნახვა'),
            display.t('Share your data for advertising', 'მონაცემების გაზიარება რეკლამისთვის'),
          ]}
        />
        <ConsentSection
          title={display.t("You're in control", 'კონტროლი შენს ხელშია')}
          symbol="hand.raised.fill"
          tint="lavender"
          items={[
            display.t('Read-only access, renewed every 90 days', 'მხოლოდ ნახვის წვდომა, განახლდება ყოველ 90 დღეში'),
            display.t('Disconnect anytime in Settings', 'გათიშე ნებისმიერ დროს პარამეტრებიდან'),
            display.t('Delete imported data with one tap', 'იმპორტირებული მონაცემები ერთი შეხებით წაიშლება'),
          ]}
        />
      </div>
    </Sheet>
  );
}

interface ConsentSectionProps {
  title: string;
  symbol: string;
  tint: PaletteToken;
  items: readonly string[];
}

function ConsentSection({ title, symbol, tint, items }: ConsentSectionProps) {
  return (
    <Card>
      <h3 className="type-headline text-ink">{title}</h3>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="pt-px" style={{ color: palette[tint] }}>
              <Icon name={symbol} size={20} />
            </span>
            <span className="type-subheadline text-ink">{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
