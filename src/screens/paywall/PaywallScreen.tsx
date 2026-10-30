import { Fragment, useState } from 'react';
import { Button, Card, delay, Divider, HeaderButton, Icon, IllustrationStage, MascotView, StatusBanner } from '../../design/index.ts';
import { FREE_MONTHLY_AI_RECOMMENDATIONS, lt, PREMIUM_MONTHLY_PRICE, type LocalizedText } from '../../engine/index.ts';
import { useRouter } from '../../layout/router/Router.tsx';
import type { ScreenProps } from '../../layout/router/routeTable.ts';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';

/** The prototype "purchase" takes as long as a real one would feel. */
const PURCHASE_DELAY_MS = 1200;

interface Feature {
  readonly title: LocalizedText;
  /** Null when the free plan doesn't include it. */
  readonly free: LocalizedText | null;
  readonly premium: LocalizedText;
}

const included = lt('Included', 'შედის');
const basic = lt('Basic', 'საბაზისო');

const FEATURES: readonly Feature[] = [
  { title: lt('Transaction history', 'ტრანზაქციების ისტორია'), free: included, premium: included },
  { title: lt('Financial overview & categories', 'ფინანსური მიმოხილვა და კატეგორიები'), free: included, premium: included },
  {
    title: lt('Personalized AI coaching', 'პერსონალური AI რჩევები'),
    free: lt(`${FREE_MONTHLY_AI_RECOMMENDATIONS} a month`, `თვეში ${FREE_MONTHLY_AI_RECOMMENDATIONS}`),
    premium: lt('Extended', 'გაფართოებული'),
  },
  { title: lt('Weekly spending recommendations', 'კვირის ხარჯების რეკომენდაციები'), free: null, premium: lt('Every week', 'ყოველ კვირა') },
  { title: lt('Deeper behavior analysis', 'ჩვევების სიღრმისეული ანალიზი'), free: null, premium: included },
  { title: lt('Projections & what-if scenarios', 'პროგნოზები და „რა იქნება, თუ“ სცენარები'), free: basic, premium: lt('Advanced', 'გაფართოებული') },
  {
    title: lt('Savings goals & planning', 'დანაზოგის მიზნები და დაგეგმვა'),
    free: basic,
    premium: lt('More goals, personal plans', 'მეტი მიზანი, პირადი გეგმები'),
  },
];

/**
 * An honest paywall (PaywallView.swift): a clear comparison, transparent renewal terms, and an equally visible free
 * option. No timers, no fake discounts. The web prototype never takes a payment; "buying" only switches the plan.
 */
export default function PaywallScreen(_props: ScreenProps) {
  const store = useAppStore();
  const display = useDisplay();
  const router = useRouter();
  const close = () => router.back('/');

  return (
    <ScreenLayout
      title="Premium"
      width="narrow"
      leading={<HeaderButton title={display.t('Close', 'დახურვა')} onClick={close} />}
    >
      {store.getState().plan === 'premium' ? <PremiumConfirmation onDone={close} /> : <Offer onContinueFree={close} />}
    </ScreenLayout>
  );
}

function Offer({ onContinueFree }: { onContinueFree: () => void }) {
  const store = useAppStore();
  const display = useDisplay();
  const [isPurchasing, setPurchasing] = useState(false);
  const price = display.money(PREMIUM_MONTHLY_PRICE, { precision: 'whole' });

  const purchase = async () => {
    setPurchasing(true);
    await delay(PURCHASE_DELAY_MS);
    store.setPlan('premium');
  };

  return (
    <>
      <IllustrationStage pose="overview" height={210} className="rounded-xl" />
      <div className="flex flex-col gap-2">
        <h2 className="type-title text-ink">{display.t('Get more from your coach', 'მიიღე მეტი შენი ქოუჩისგან')}</h2>
        <p className="type-callout text-inkSoft">
          {display.t(
            `Algi stays free to use. Premium adds deeper coaching for ${price} a month.`,
            `Algi უფასო რჩება. Premium თვეში ${price}-ად სიღრმისეულ რჩევებს ამატებს.`,
          )}
        </p>
      </div>

      <Comparison />

      <div className="flex flex-col gap-2">
        <Button isLoading={isPurchasing} onClick={() => void purchase()}>
          {isPurchasing
            ? display.t('Starting Premium…', 'Premium იწყება…')
            : display.t(`Start Premium · ${price}/month`, `Premium-ის დაწყება · ${price}/თვე`)}
        </Button>
        <Button kind="secondary" disabled={isPurchasing} onClick={onContinueFree}>
          {display.t('Continue with Free', 'უფასო ვერსიით გაგრძელება')}
        </Button>
      </div>

      <p className="type-caption text-inkMuted">
        {display.t(
          `${price} per month, renews automatically until you cancel. Cancel anytime in Settings. This web prototype never takes a payment.`,
          `თვეში ${price}, ავტომატურად განახლდება გაუქმებამდე. გააუქმე ნებისმიერ დროს პარამეტრებიდან. ეს ვებ-პროტოტიპი გადახდას არასდროს ჩამოჭრის.`,
        )}
      </p>
    </>
  );
}

function Comparison() {
  const display = useDisplay();
  return (
    <Card>
      <div role="table" aria-label={display.t('Free and Premium compared', 'უფასო და Premium-ის შედარება')}>
        <div role="row" className="type-footnote grid grid-cols-[minmax(0,1fr)_84px_96px] gap-2 pb-2 font-bold text-ink">
          <span role="columnheader">
            <span className="sr-only">{display.t('Feature', 'ფუნქცია')}</span>
          </span>
          <span role="columnheader" className="text-center">
            {display.t('Free', 'უფასო')}
          </span>
          <span role="columnheader" className="text-center text-mintDark">
            Premium
          </span>
        </div>
        {FEATURES.map((feature) => (
          <Fragment key={feature.title.en}>
            <Divider />
            <div role="row" className="grid grid-cols-[minmax(0,1fr)_84px_96px] items-center gap-2 py-3">
              <span role="rowheader" className="type-footnote font-medium text-ink">
                {display.text(feature.title)}
              </span>
              <PlanCell value={feature.free} />
              <PlanCell value={feature.premium} isHighlighted />
            </div>
          </Fragment>
        ))}
      </div>
    </Card>
  );
}

function PlanCell({ value, isHighlighted = false }: { value: LocalizedText | null; isHighlighted?: boolean }) {
  const display = useDisplay();
  return (
    <span role="cell" className="flex justify-center text-center">
      {value ? (
        <span className={`type-caption font-semibold ${isHighlighted ? 'text-mintDark' : 'text-inkSoft'}`}>{display.text(value)}</span>
      ) : (
        <span className="text-inkMuted">
          <Icon name="minus" size={16} label={display.t('Not included', 'არ შედის')} />
        </span>
      )}
    </span>
  );
}

function PremiumConfirmation({ onDone }: { onDone: () => void }) {
  const display = useDisplay();
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <MascotView pose="achievement" className="h-[260px] w-auto" />
      <h2 className="type-title text-ink">{display.t("You're on Premium", 'შენ Premium-ზე ხარ')}</h2>
      <p className="type-body text-inkSoft">
        {display.t('Weekly recommendations and deeper coaching are unlocked.', 'კვირის რეკომენდაციები და სიღრმისეული რჩევები გახსნილია.')}
      </p>
      <StatusBanner
        kind="info"
        title={display.t('Prototype purchase', 'პროტოტიპის შესყიდვა')}
        message={display.t('No payment was taken. This is a demo of the Premium flow.', 'გადახდა არ ჩამოჭრილა. ეს Premium-ის სადემონსტრაციო ვერსიაა.')}
        className="w-full text-left"
      />
      <Button onClick={onDone}>{display.t('Done', 'მზადაა')}</Button>
    </div>
  );
}
