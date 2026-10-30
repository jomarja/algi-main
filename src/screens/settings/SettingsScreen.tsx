import { useState } from 'react';
import { HeaderButton, StatusBanner } from '../../design/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { BankAccountsSection } from './BankAccountsSection.tsx';
import { ConfirmationSheet } from './ConfirmationSheet.tsx';
import { AboutSection, NotificationsSection, PreferencesSection, PrivacySection, ProfileHeader, SubscriptionSection } from './SettingsSections.tsx';

type Confirmation = 'export' | 'delete';

/** Profile, preferences, TBC Bank, subscription, notifications, privacy, and about (SettingsView.swift). */
export default function SettingsScreen(_props: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const prepareExport = (format: 'CSV' | 'PDF') => {
    setExportMessage(
      display.t(
        `Your ${format} export is ready to share. (Prototype — no file is created.)`,
        `შენი ${format} ექსპორტი მზადაა გასაზიარებლად. (პროტოტიპი — ფაილი არ იქმნება.)`,
      ),
    );
  };

  const startOver = () => {
    store.restartOnboarding();
    router.navigate('/welcome', { replace: true });
  };

  const deleteAccount = () => {
    if (store.isBankConnected) void store.disconnectBank();
    startOver();
  };

  return (
    <ScreenLayout
      title={display.t('Profile', 'პროფილი')}
      back={false}
      trailing={<HeaderButton title={display.t('Done', 'მზადაა')} isProminent onClick={() => router.back('/')} />}
    >
      <ProfileHeader />
      {exportMessage && (
        <StatusBanner kind="success" title={display.t('Export ready', 'ექსპორტი მზადაა')} message={exportMessage} className="animate-page-fade" />
      )}
      <PreferencesSection />
      <BankAccountsSection />
      <SubscriptionSection />
      <NotificationsSection />
      <PrivacySection onExport={() => setConfirmation('export')} onDelete={() => setConfirmation('delete')} />
      <AboutSection onRestartOnboarding={startOver} />

      <ConfirmationSheet
        isOpen={confirmation === 'export'}
        onClose={() => setConfirmation(null)}
        title={display.t('Export your data', 'მონაცემების ექსპორტი')}
        actions={[
          { title: display.t('Transactions (CSV)', 'ტრანზაქციები (CSV)'), onConfirm: () => prepareExport('CSV') },
          { title: display.t('Summary report (PDF)', 'შემაჯამებელი ანგარიში (PDF)'), onConfirm: () => prepareExport('PDF') },
        ]}
      />
      <ConfirmationSheet
        isOpen={confirmation === 'delete'}
        onClose={() => setConfirmation(null)}
        title={display.t('Delete your account?', 'წავშალოთ ანგარიში?')}
        message={display.t(
          "This removes your goals, transactions, and connections. It can't be undone. In the prototype, it resets the demo.",
          'ეს წაშლის მიზნებს, ტრანზაქციებსა და კავშირებს. მოქმედება შეუქცევადია. პროტოტიპში ის დემოს თავიდან იწყებს.',
        )}
        actions={[{ title: display.t('Delete account and data', 'ანგარიშისა და მონაცემების წაშლა'), destructive: true, onConfirm: deleteAccount }]}
      />
    </ScreenLayout>
  );
}
