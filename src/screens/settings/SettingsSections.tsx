import {
  CurrencyPicker,
  Icon,
  LanguageSwitcher,
  ListItem,
  ListRow,
  ListSection,
  Tag,
  Toggle,
} from '../../design/index.ts';
import {
  FINANCIAL_OBJECTIVES,
  FREE_MONTHLY_AI_RECOMMENDATIONS,
  OBJECTIVE_META,
  PersonalNumber,
  PREMIUM_MONTHLY_PRICE,
  SAMPLE_PROFILE,
  type NotificationPreferences,
} from '../../engine/index.ts';
import { Link } from '../../layout/router/Link.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { bankSourceCopy } from '../onboarding/bankSource.ts';
import { MenuSelect } from '../transactions/MenuSelect.tsx';

/** Initials, name, and where the numbers come from. */
export function ProfileHeader() {
  const store = useAppStore();
  const display = useDisplay();
  const sourceTag = bankSourceCopy(store.getState().bank.status?.source)?.tag;
  const dataLabel = store.isBankConnected
    ? sourceTag
      ? display.text(sourceTag)
      : 'TBC Bank'
    : display.t('Manual entries', 'ხელით შეყვანილი');

  return (
    <div className="flex items-center gap-4 py-2">
      <span aria-hidden className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-ink font-rounded text-[20px] font-extrabold text-white">
        {SAMPLE_PROFILE.initials}
      </span>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="type-headline text-ink">{display.text(SAMPLE_PROFILE.fullName)}</p>
        <Tag text={dataLabel} icon={store.isBankConnected ? 'building.columns' : 'flask'} />
      </div>
    </div>
  );
}

export function PreferencesSection() {
  const store = useAppStore();
  const display = useDisplay();
  const { language, displayCurrency, objective } = store.getState();
  const ratesDate = display.date(store.converter.asOf, 'dayMonthYear');

  return (
    <ListSection
      header={display.t('Preferences', 'პარამეტრები')}
      footer={display.t(
        `Original transaction amounts are always kept. Conversions use illustrative sample rates from ${ratesDate} — not live rates.`,
        `ტრანზაქციების ორიგინალი თანხები ყოველთვის ინახება. გადაყვანა ხდება ${ratesDate}-ის სანიმუშო კურსით — არა რეალური კურსით.`,
      )}
    >
      <ListItem>
        <div className="flex flex-col gap-2 py-1">
          <span className="type-footnote font-semibold text-inkSoft">{display.t('Language', 'ენა')}</span>
          <LanguageSwitcher value={language} onChange={(next) => store.setLanguage(next)} />
        </div>
      </ListItem>
      <ListItem>
        <div className="flex flex-col gap-2 py-1">
          <span className="type-footnote font-semibold text-inkSoft">{display.t('Display currency', 'საჩვენებელი ვალუტა')}</span>
          <CurrencyPicker value={displayCurrency} onChange={(next) => store.setDisplayCurrency(next)} />
        </div>
      </ListItem>
      <ListItem>
        <div className="flex min-h-[36px] items-center justify-between gap-3">
          <span className="type-body text-ink">{display.t('Main focus', 'მთავარი ფოკუსი')}</span>
          <MenuSelect
            value={objective}
            options={FINANCIAL_OBJECTIVES}
            onChange={(next) => store.setObjective(next)}
            title={(option) => display.text(OBJECTIVE_META[option].title)}
            label={display.t('Main focus', 'მთავარი ფოკუსი')}
            className="type-body inline-flex min-w-0 items-center gap-1 rounded-sm text-inkSoft"
          >
            <span className="truncate">{display.text(OBJECTIVE_META[objective].title)}</span>
            <Icon name="chevron.down" size={12} />
          </MenuSelect>
        </div>
      </ListItem>
    </ListSection>
  );
}

export function SubscriptionSection() {
  const store = useAppStore();
  const display = useDisplay();
  const isPremium = store.getState().plan === 'premium';
  const price = display.money(PREMIUM_MONTHLY_PRICE, { precision: 'whole' });
  const left = store.remainingFreeAIRecommendations;

  return (
    <ListSection header={display.t('Subscription', 'გამოწერა')}>
      <Link to="/paywall" className="flex min-h-[44px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-cream/50 active:bg-cream">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-body font-semibold text-ink">{isPremium ? 'Premium' : display.t('Free plan', 'უფასო გეგმა')}</span>
          <span className="type-footnote text-inkSoft">
            {isPremium
              ? display.t(`Renews monthly · ${price}`, `განახლდება ყოველთვე · ${price}`)
              : display.t(
                  `${left} of ${FREE_MONTHLY_AI_RECOMMENDATIONS} AI answers left this month`,
                  `ამ თვეში დარჩა ${left} / ${FREE_MONTHLY_AI_RECOMMENDATIONS} AI პასუხი`,
                )}
          </span>
        </span>
        <span className="type-footnote shrink-0 font-semibold text-mintDark">
          {isPremium ? display.t('Manage', 'მართვა') : display.t('Upgrade', 'გაუმჯობესება')}
        </span>
      </Link>
      {isPremium && (
        <ListRow title={display.t('Cancel subscription', 'გამოწერის გაუქმება')} destructive onClick={() => store.setPlan('free')} />
      )}
    </ListSection>
  );
}

export function NotificationsSection() {
  const store = useAppStore();
  const display = useDisplay();
  const { notifications } = store.getState();
  const toggles: ReadonlyArray<{ key: keyof NotificationPreferences; label: string }> = [
    { key: 'weeklyPlan', label: display.t('Weekly plan every Monday', 'კვირის გეგმა ყოველ ორშაბათს') },
    { key: 'budgetNudges', label: display.t('Gentle budget nudges', 'ბიუჯეტის რბილი შეხსენებები') },
    { key: 'goalMilestones', label: display.t('Goal milestones', 'მიზნის ეტაპები') },
    { key: 'productNews', label: display.t('Product news', 'სიახლეები') },
  ];

  return (
    <ListSection header={display.t('Notifications', 'შეტყობინებები')}>
      {toggles.map(({ key, label }) => (
        <ListItem key={key}>
          <Toggle label={label} checked={notifications[key]} onChange={(checked) => store.setNotifications({ ...notifications, [key]: checked })} />
        </ListItem>
      ))}
    </ListSection>
  );
}

interface PrivacySectionProps {
  onExport: () => void;
  onDelete: () => void;
}

export function PrivacySection({ onExport, onDelete }: PrivacySectionProps) {
  const store = useAppStore();
  const display = useDisplay();
  const { personalInfo } = store.getState();

  return (
    <ListSection
      header={display.t('Privacy & data', 'კონფიდენციალურობა და მონაცემები')}
      footer={display.t('Algi never sells your data and only reads it to coach you.', 'Algi არასდროს ყიდის შენს მონაცემებს და მათ მხოლოდ რჩევებისთვის იყენებს.')}
    >
      <ListRow
        title={display.t('Personal information', 'პირადი ინფორმაცია')}
        value={personalInfo ? PersonalNumber.masked(personalInfo.personalNumber) : display.t('Not added', 'არ არის დამატებული')}
        to="/settings/personal-info"
      />
      <ListRow title={display.t('Data-sharing permissions', 'მონაცემების გაზიარების ნებართვები')} to="/settings/permissions" />
      <ListRow title={display.t('Export my data', 'ჩემი მონაცემების ექსპორტი')} onClick={onExport} />
      <ListRow title={display.t('Delete account', 'ანგარიშის წაშლა')} destructive onClick={onDelete} />
    </ListSection>
  );
}

export function AboutSection({ onRestartOnboarding }: { onRestartOnboarding: () => void }) {
  const display = useDisplay();
  return (
    <ListSection header={display.t('About', 'აპის შესახებ')}>
      <ListRow title={display.t('Design system', 'დიზაინ სისტემა')} to="/settings/design-system" />
      <ListRow title={display.t('Restart onboarding', 'ონბორდინგის თავიდან დაწყება')} onClick={onRestartOnboarding} />
      <ListRow title={display.t('Version', 'ვერსია')} value={display.t('1.0 · web', '1.0 · ვები')} />
    </ListSection>
  );
}
