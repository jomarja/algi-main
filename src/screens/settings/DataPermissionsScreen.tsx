import { ListItem, ListRow, ListSection, Toggle } from '../../design/index.ts';
import type { DataPermissions } from '../../engine/index.ts';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { consentValidUntilText } from './settingsModel.ts';

/** What Algi may use, and the TBC consent behind the bank data (DataPermissionsView in SettingsView.swift). */
export default function DataPermissionsScreen(_props: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const { permissions, bank } = store.getState();
  const validUntil = store.isBankConnected ? consentValidUntilText(bank.status?.consent ?? null, display) : null;
  const set = (change: Partial<DataPermissions>) => store.setPermissions({ ...permissions, ...change });

  return (
    <ScreenLayout title={display.t('Permissions', 'ნებართვები')}>
      <ListSection
        footer={display.t(
          'Turning off coaching data stops personalized answers. Your transactions stay private and are never used for advertising.',
          'რჩევებისთვის მონაცემების გათიშვა პერსონალურ პასუხებს შეაჩერებს. შენი ტრანზაქციები პირადია და რეკლამისთვის არასდროს გამოიყენება.',
        )}
      >
        <ListItem>
          <Toggle
            label={display.t('Use my transactions for AI coaching', 'ჩემი ტრანზაქციების გამოყენება AI რჩევებისთვის')}
            checked={permissions.useTransactionsForCoaching}
            onChange={(checked) => set({ useTransactionsForCoaching: checked })}
          />
        </ListItem>
        <ListItem>
          <Toggle
            label={display.t('Personalized nudges', 'პერსონალური შეხსენებები')}
            checked={permissions.personalizedNudges}
            onChange={(checked) => set({ personalizedNudges: checked })}
          />
        </ListItem>
      </ListSection>

      <ListSection
        footer={display.t(
          'Helps us improve Algi. Never includes amounts, merchants, or account details.',
          'გვეხმარება Algi-ს გაუმჯობესებაში. არასდროს შეიცავს თანხებს, მერჩანტებს ან ანგარიშის დეტალებს.',
        )}
      >
        <ListItem>
          <Toggle
            label={display.t('Share anonymous usage analytics', 'ანონიმური ანალიტიკის გაზიარება')}
            checked={permissions.anonymousAnalytics}
            onChange={(checked) => set({ anonymousAnalytics: checked })}
          />
        </ListItem>
      </ListSection>

      <ListSection header={display.t('Bank consent', 'საბანკო თანხმობა')}>
        <ListRow title={display.t('Access type', 'წვდომის ტიპი')} value={display.t('Read-only', 'მხოლოდ ნახვა')} />
        <ListRow title={display.t('Renewal', 'განახლება')} value={display.t('Every 90 days', 'ყოველ 90 დღეში')} />
        {validUntil && <ListRow title={display.t('Valid until', 'მოქმედებს')} value={validUntil} />}
        <ListRow title={display.t('Active connections', 'აქტიური კავშირები')} value={store.isBankConnected ? '1' : '0'} />
      </ListSection>
    </ScreenLayout>
  );
}
