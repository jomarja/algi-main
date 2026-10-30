import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CATEGORY_META } from '../engine/categories.ts';
import type { AppLanguage } from '../engine/localization.ts';
import { add, gel, usd } from '../engine/money.ts';
import type { CurrencyCode, Money } from '../engine/money.ts';
import { ScreenLayout } from '../layout/ScreenLayout.tsx';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { BrandMark } from './Brand.tsx';
import { Button } from './Button.tsx';
import { Card, DetailRow, Divider, SectionHeader } from './Card.tsx';
import { ChatBubble, TypingIndicator } from './ChatBubble.tsx';
import { ChoiceCard } from './ChoiceCard.tsx';
import { EmptyState } from './EmptyState.tsx';
import { FilterChip } from './FilterChip.tsx';
import { Icon } from './Icon.tsx';
import { symbolNames } from './icons.ts';
import { ListItem, ListRow, ListSection } from './List.tsx';
import { ConfettiBurst } from './mascot/ConfettiBurst.tsx';
import { FloatingOnCoins } from './mascot/FloatingOnCoins.tsx';
import { LukaAnimation } from './mascot/LukaAnimation.tsx';
import { DestinationView, IllustrationStage, LukaAvatarTile, MascotAvatar, MascotView, PropView } from './mascot/MascotView.tsx';
import { MoneyTossOverlay } from './mascot/MoneyTossOverlay.tsx';
import { PeekingLuka } from './mascot/PeekingLuka.tsx';
import { illustrationProps, journeyDestinations, mascotPoseInfo, mascotPoses } from './mascot/assets.ts';
import { ProgressBar, ProgressRing, TrendWave } from './Progress.tsx';
import { RecommendationCard } from './RecommendationCard.tsx';
import { CurrencyPicker, LanguageSwitcher } from './SegmentedPicker.tsx';
import { Sheet } from './Sheet.tsx';
import { Skeleton, SkeletonCard } from './Skeleton.tsx';
import { StatusBanner } from './StatusBanner.tsx';
import { Tag } from './Tag.tsx';
import { TextField } from './TextField.tsx';
import { useToast } from './Toast.tsx';
import { Toggle } from './Toggle.tsx';
import { palette } from './tokens.ts';
import type { PaletteToken } from './tokens.ts';
import { TransactionRow } from './TransactionRow.tsx';
import { Overline } from './Typography.tsx';
import { ValueSlider } from './ValueSlider.tsx';
import { ValueStepper } from './ValueStepper.tsx';

/** A living reference of the design system: tokens, components in each state, and every mascot pose. */
export default function Gallery() {
  const display = useDisplay();
  return (
    <ScreenLayout title={display.t('Design system', 'დიზაინ სისტემა')} width="wide">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <MascotSection />
        <div className="flex flex-col gap-8">
          <ColorSection />
          <TypeSection />
        </div>
        <ButtonSection />
        <FeedbackSection />
        <ControlSection />
        <DataSection />
        <ConversationSection />
        <OverlaySection />
        <MotionSection />
        <ListSectionDemo />
      </div>
      <IconSection />
    </ScreenLayout>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <Overline as="h2">{title}</Overline>
      {children}
    </section>
  );
}

function MascotSection() {
  const display = useDisplay();
  return (
    <Section title={display.t('Mascot · Luka', 'მასკოტი · ლუკა')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mascotPoses.map((pose) => (
          <figure key={pose} className="flex flex-col items-center gap-2">
            <div className="flex h-[140px] w-full items-center justify-center rounded-lg bg-mintPale">
              <MascotView pose={pose} className="h-full w-auto" />
            </div>
            <figcaption className="type-caption text-inkSoft">{display.text(mascotPoseInfo[pose].title)}</figcaption>
          </figure>
        ))}
      </div>
      <div className="flex min-h-[72px] items-center justify-center gap-5 rounded-lg bg-ink">
        {illustrationProps.map((prop) => (
          <PropView key={prop} prop={prop} className="h-9 w-auto" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {journeyDestinations.map((destination) => (
          <div key={destination} className="flex h-[72px] items-center justify-center rounded-md bg-cream">
            <DestinationView destination={destination} className="h-full w-auto" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <MascotAvatar size={32} />
        <MascotAvatar />
        <LukaAvatarTile className="h-[68px] w-[68px]" />
        <BrandMark />
      </div>
      <IllustrationStage pose="achievement" height={240} className="rounded-xl" />
    </Section>
  );
}

const swatchOrder = Object.keys(palette) as PaletteToken[];

function ColorSection() {
  const display = useDisplay();
  return (
    <Section title={display.t('Color', 'ფერი')}>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {swatchOrder.map((token) => (
          <div key={token} className="flex flex-col items-center gap-1">
            <span className="h-12 w-full rounded-sm border border-line" style={{ backgroundColor: palette[token] }} />
            <span className="text-[11px] text-inkSoft">{token}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TypeSection() {
  const display = useDisplay();
  // Literal class names, so Tailwind finds them when it scans the source.
  const samples: Array<[string, string]> = [
    ['type-title', 'Title · სათაური'],
    ['type-title2', 'Title 2 · სათაური 2'],
    ['type-title3', 'Title 3 · სათაური 3'],
    ['type-headline', 'Headline · სათაური'],
    ['type-body', 'Body text · ძირითადი ტექსტი'],
    ['type-callout', 'Callout · გამოძახება'],
    ['type-subheadline', 'Subheadline · ქვესათაური'],
    ['type-footnote', 'Footnote · სქოლიო'],
    ['type-caption', 'Caption · წარწერა'],
    ['type-overline', 'Overline · ზედა წარწერა'],
  ];
  return (
    <Section title={display.t('Type', 'ტიპოგრაფია')}>
      <div className="flex flex-col gap-2 text-ink">
        <p className="type-display">{display.money(gel(12840.7))}</p>
        {samples.map(([className, text]) => (
          <p key={className} className={className}>
            {text}
          </p>
        ))}
      </div>
    </Section>
  );
}

function ButtonSection() {
  const display = useDisplay();
  return (
    <Section title={display.t('Buttons', 'ღილაკები')}>
      <div className="flex flex-col gap-2">
        <Button trailingIcon="arrow.right">{display.t('Primary', 'მთავარი')}</Button>
        <Button isLoading>{display.t('Loading', 'იტვირთება')}</Button>
        <Button disabled>{display.t('Disabled', 'გათიშული')}</Button>
        <Button kind="secondary" icon="plus">
          {display.t('Secondary', 'მეორეხარისხოვანი')}
        </Button>
        <Button kind="destructive">{display.t('Destructive', 'წაშლა')}</Button>
        <Button kind="tertiary" className="self-center">
          {display.t('Tertiary', 'მესამეხარისხოვანი')}
        </Button>
      </div>
    </Section>
  );
}

function FeedbackSection() {
  const display = useDisplay();
  const toast = useToast();
  return (
    <Section title={display.t('Feedback', 'უკუკავშირი')}>
      <div className="flex flex-col gap-2">
        <StatusBanner kind="info" title={display.t('Info', 'ინფორმაცია')} message={display.t('Neutral, explanatory.', 'ნეიტრალური, განმარტებითი.')} />
        <StatusBanner kind="success" title={display.t('Success', 'წარმატება')} message={display.t('Something went well.', 'ყველაფერი კარგად წავიდა.')} />
        <StatusBanner kind="warning" title={display.t('Warning', 'ყურადღება')} message={display.t('Amber, never alarming.', 'ქარვისფერი, არასდროს შემაშფოთებელი.')} />
        <StatusBanner kind="error" title={display.t('Error', 'შეცდომა')} message={display.t('Something needs fixing.', 'რაღაც გამოსასწორებელია.')} />
        <div className="flex flex-wrap gap-2">
          <Tag text={display.t('Neutral', 'ნეიტრალური')} />
          <Tag text={display.t('Positive', 'დადებითი')} tone="positive" />
          <Tag text={display.t('Attention', 'ყურადღება')} tone="attention" />
          <Tag text={display.t('Estimate', 'შეფასება')} tone="estimate" icon="sparkle" />
        </div>
        <Button
          kind="secondary"
          onClick={() =>
            toast.show({ kind: 'success', title: display.t("You're all caught up", 'ყველაფერი განახლებულია') })
          }
        >
          {display.t('Show a toast', 'შეტყობინების ჩვენება')}
        </Button>
      </div>
    </Section>
  );
}

function ControlSection() {
  const display = useDisplay();
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [currency, setCurrency] = useState<CurrencyCode>('GEL');
  const [chip, setChip] = useState<'selected' | 'default'>('selected');
  const [choice, setChoice] = useState<'save' | 'spend'>('save');
  const [months, setMonths] = useState(12);
  const [savings, setSavings] = useState(150);
  const [isOn, setOn] = useState(true);
  const [phone, setPhone] = useState('');

  return (
    <Section title={display.t('Controls', 'მართვის ელემენტები')}>
      <div className="flex flex-col gap-3">
        <LanguageSwitcher value={language} onChange={setLanguage} />
        <CurrencyPicker value={currency} onChange={setCurrency} />
        <div className="flex flex-wrap gap-2">
          <FilterChip title={display.t('Selected', 'არჩეული')} isSelected={chip === 'selected'} onClick={() => setChip('selected')} />
          <FilterChip title={display.t('Default', 'ჩვეულებრივი')} icon="calendar" isSelected={chip === 'default'} onClick={() => setChip('default')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard isSelected={choice === 'save'} onClick={() => setChoice('save')}>
            <Icon name="banknote.fill" size={22} className="text-mintDark" />
            <p className="type-headline mt-2 text-ink">{display.t('Build my savings', 'დანაზოგის შექმნა')}</p>
          </ChoiceCard>
          <ChoiceCard isSelected={choice === 'spend'} onClick={() => setChoice('spend')}>
            <Icon name="slider.horizontal.3" size={22} className="text-mintDark" />
            <p className="type-headline mt-2 text-ink">{display.t('Control my spending', 'ხარჯების კონტროლი')}</p>
          </ChoiceCard>
        </div>
        <Card>
          <ValueStepper value={months} onChange={setMonths} min={1} max={60} label={display.t(`Months, ${months}`, `თვე, ${months}`)}>
            <p className="type-subheadline text-inkSoft">{display.t('Months', 'თვე')}</p>
            <p className="type-headline text-ink">{months}</p>
          </ValueStepper>
          <Divider />
          <div className="pt-3">
            <div className="flex justify-between">
              <span className="type-subheadline text-inkSoft">{display.t('Monthly savings', 'თვიური დანაზოგი')}</span>
              <span className="type-headline text-ink">{display.money(gel(savings), { precision: 'whole' })}</span>
            </div>
            <ValueSlider
              value={savings}
              onChange={setSavings}
              min={0}
              max={500}
              step={10}
              label={display.t('Monthly savings', 'თვიური დანაზოგი')}
              valueText={display.money(gel(savings), { precision: 'whole' })}
            />
          </div>
        </Card>
        <Toggle label={display.t('Gentle budget nudges', 'ბიუჯეტის რბილი შეხსენებები')} checked={isOn} onChange={setOn} />
        <TextField
          label={display.t('Mobile number', 'მობილურის ნომერი')}
          prefix="+995"
          inputMode="tel"
          placeholder="5XX XX XX XX"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={phone && !phone.startsWith('5') ? display.t('Georgian mobile numbers start with 5.', 'ქართული მობილურის ნომერი 5-ით იწყება.') : undefined}
        />
      </div>
    </Section>
  );
}

function DataSection() {
  const display = useDisplay();
  const now = new Date();
  const foreign = usd(-12.99);
  return (
    <Section title={display.t('Data', 'მონაცემები')}>
      <div className="flex flex-col gap-3">
        <Card>
          <div className="flex items-center gap-4">
            <ProgressRing value={0.66} label="66%" />
            <div className="flex flex-1 flex-col gap-3">
              <ProgressBar value={0.4} />
              <ProgressBar value={0.83} tint="amber" />
              <ProgressBar value={1} tint="coral" />
            </div>
          </div>
        </Card>
        <Card padding="s">
          <TransactionRow
            merchant="Netflix"
            detail={`${display.relativeDay(now, now)} · ${display.text(CATEGORY_META.subscriptions.title)}`}
            amount={display.original(foreign, { sign: 'always' })}
            convertedAmount={display.money(foreign, { sign: 'always' })}
            category={CATEGORY_META.subscriptions}
            hasReceipt
          />
          <Divider inset={56} />
          <TransactionRow
            merchant={display.t('Salary', 'ხელფასი')}
            detail={`${display.t('Yesterday', 'გუშინ')} · ${display.text(CATEGORY_META.income.title)}`}
            amount={display.original(gel(1800), { sign: 'always' })}
            isIncome
            category={CATEGORY_META.income}
          />
        </Card>
        <RecommendationCard
          overline={display.t('Your next step', 'შენი შემდეგი ნაბიჯი')}
          title={display.t('A clear, single action.', 'ერთი, მკაფიო მოქმედება.')}
          message={display.t('One sentence on why it matters.', 'ერთი წინადადება, რატომ არის მნიშვნელოვანი.')}
          linkTitle={display.t('Why am I seeing this?', 'რატომ ვხედავ ამას?')}
          onLinkClick={() => undefined}
        />
        <Card background="ink" bordered={false}>
          <p className="type-footnote font-medium text-white/75">{display.t('Total balance', 'ჯამური ბალანსი')}</p>
          <p className="type-display text-white">{display.money(gel(2480.35))}</p>
          <TrendWave values={[14.2, 14.0, 13.5, 13.9, 15.0, 14.6, 15.4, 16.1, 15.7, 16.6, 17.3]} className="mt-4" />
        </Card>
        <Card>
          <SectionHeader title={display.t('Recent activity', 'ბოლო აქტივობა')} actionTitle={display.t('See all', 'ყველა')} onAction={() => undefined} />
          <DetailRow title={display.t('Monthly plan', 'თვიური გეგმა')} value={display.money(gel(1250), { precision: 'whole' })} />
          <DetailRow title={display.t('Left this month', 'დარჩა ამ თვეში')} value={display.money(gel(312), { precision: 'whole' })} valueTone="mintDark" />
        </Card>
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-6 w-40" />
          <SkeletonCard />
        </div>
      </div>
    </Section>
  );
}

function ConversationSection() {
  const display = useDisplay();
  return (
    <Section title={display.t('Conversation', 'საუბარი')}>
      <div className="flex flex-col gap-3">
        <ChatBubble role="user" text={display.t('How much can I spend this week?', 'რამდენი შემიძლია დავხარჯო ამ კვირაში?')} />
        <ChatBubble role="coach" text={display.t('About 323 ₾ — roughly 81 ₾ a day.', 'დაახლოებით 323 ₾ — დღეში 81 ₾.')} />
        <TypingIndicator />
      </div>
    </Section>
  );
}

function OverlaySection() {
  const display = useDisplay();
  const [openSheet, setOpenSheet] = useState<'dialog' | 'panel' | null>(null);
  const close = () => setOpenSheet(null);
  return (
    <Section title={display.t('Sheets', 'ფურცლები')}>
      <div className="flex flex-col gap-2">
        <Button kind="secondary" onClick={() => setOpenSheet('dialog')}>
          {display.t('Bottom sheet / dialog', 'ქვედა ფურცელი / დიალოგი')}
        </Button>
        <Button kind="secondary" onClick={() => setOpenSheet('panel')}>
          {display.t('Side panel', 'გვერდითი პანელი')}
        </Button>
      </div>
      <Sheet
        isOpen={openSheet !== null}
        onClose={close}
        presentation={openSheet === 'panel' ? 'panel' : 'dialog'}
        title={display.t('New goal', 'ახალი მიზანი')}
        leadingAction={{ title: display.t('Cancel', 'გაუქმება'), onClick: close }}
        trailingAction={{ title: display.t('Save', 'შენახვა'), onClick: close }}
      >
        <div className="flex flex-col gap-4 pt-2">
          <TextField label={display.t('Goal name', 'მიზნის სახელი')} placeholder={display.t('A car', 'მანქანა')} />
          <StatusBanner kind="info" title={display.t('Swipe down, press Esc, or tap outside to close.', 'დასახურად ჩამოწიე, დააჭირე Esc-ს ან შეეხე გარეთ.')} />
        </div>
      </Sheet>
    </Section>
  );
}

function MotionSection() {
  const display = useDisplay();
  const [reveal, setReveal] = useState(1);
  const [isRefreshing, setRefreshing] = useState(false);
  const [hops, setHops] = useState(0);
  const [shakes, setShakes] = useState(0);
  const [bursts, setBursts] = useState(0);

  return (
    <Section title={display.t('Motion', 'მოძრაობა')}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <LukaAnimation clip="welcome" className="aspect-[4/3] rounded-lg" />
          <LukaAnimation clip="coinSwim" alignment="trailing" className="aspect-[4/3] rounded-lg" />
        </div>
        <MoneyTossDemo />
        <Card>
          <div className="border-b border-line">
            <PeekingLuka reveal={reveal} isRefreshing={isRefreshing} />
          </div>
          <div className="pt-3">
            <ValueSlider value={reveal} onChange={setReveal} min={0} max={1} step={0.05} label={display.t('Reveal', 'გამოჩენა')} />
            <Toggle label={display.t('Refreshing', 'ახლდება')} checked={isRefreshing} onChange={setRefreshing} />
          </div>
        </Card>
        <div className="flex flex-col gap-3 rounded-lg bg-amberPale p-4">
          <FloatingOnCoins index={1} hopTrigger={hops} shakeTrigger={shakes}>
            <div className="rounded-lg bg-paper p-4 shadow-[0_6px_10px_rgba(122,78,0,0.25)]">
              <p className="type-headline text-ink">{display.t('Floating on coins', 'მონეტებზე ტივტივი')}</p>
            </div>
          </FloatingOnCoins>
          <div className="grid grid-cols-2 gap-2">
            <Button kind="secondary" onClick={() => setHops((count) => count + 1)}>
              {display.t('Hop', 'ახტომა')}
            </Button>
            <Button kind="secondary" onClick={() => setShakes((count) => count + 1)}>
              {display.t('Shake', 'შერხევა')}
            </Button>
          </div>
        </div>
        <div className="relative flex h-56 flex-col items-center justify-end overflow-hidden rounded-lg bg-mintPale">
          <ConfettiBurst key={bursts} isActive={bursts > 0} />
          <MascotView pose="achievement" className="h-40 w-auto" />
        </div>
        <Button kind="secondary" icon="sparkles" onClick={() => setBursts((count) => count + 1)}>
          {display.t('Celebrate', 'ზეიმი')}
        </Button>
      </div>
    </Section>
  );
}

function MoneyTossDemo() {
  const display = useDisplay();
  const tile = useRef<HTMLDivElement>(null);
  const balanceFigure = useRef<HTMLParagraphElement>(null);
  const [balance, setBalance] = useState(gel(2480.35));
  const [toss, setToss] = useState<{ id: number; amount: Money } | null>(null);

  return (
    <Card background="ink" bordered={false}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-footnote font-medium text-white/75">{display.t('Total balance', 'ჯამური ბალანსი')}</p>
          <p ref={balanceFigure} className="type-display text-white">
            {display.money(balance)}
          </p>
        </div>
        <LukaAvatarTile ref={tile} className="h-[68px] w-[68px] shrink-0" style={{ opacity: toss ? 0 : 1 }} />
      </div>
      <Button
        kind="secondary"
        className="mt-4"
        disabled={toss !== null}
        onClick={() => setToss({ id: Date.now(), amount: gel(120) })}
      >
        {display.t('Toss money', 'ფულის სროლა')}
      </Button>
      {toss && (
        <MoneyTossOverlay
          key={toss.id}
          origin={tile}
          target={balanceFigure}
          amountText={display.money(toss.amount, { sign: 'always' })}
          onLanded={() => setBalance((current) => add(current, toss.amount))}
          onFinished={() => setToss(null)}
        />
      )}
    </Card>
  );
}

function ListSectionDemo() {
  const display = useDisplay();
  const [weeklyPlan, setWeeklyPlan] = useState(true);
  return (
    <Section title={display.t('Lists & empty states', 'სიები და ცარიელი მდგომარეობა')}>
      <ListSection header={display.t('Privacy & data', 'კონფიდენციალურობა და მონაცემები')} footer={display.t('Algi never sells your data and only reads it to coach you.', 'Algi არასდროს ყიდის შენს მონაცემებს და მათ მხოლოდ რჩევებისთვის იყენებს.')}>
        <ListRow title={display.t('Personal information', 'პირადი ინფორმაცია')} value="•••• 4821" to="/settings/personal-info" />
        <ListItem>
          <Toggle label={display.t('Weekly plan every Monday', 'კვირის გეგმა ყოველ ორშაბათს')} checked={weeklyPlan} onChange={setWeeklyPlan} />
        </ListItem>
        <ListRow title={display.t('Delete account', 'ანგარიშის წაშლა')} destructive onClick={() => undefined} />
      </ListSection>
      <Card>
        <EmptyState
          title={display.t("Let's add your first numbers", 'დავამატოთ პირველი მონაცემები')}
          message={display.t('Luka starts coaching as soon as there is something to look at.', 'ლუკა რჩევებს მაშინვე დაიწყებს, როგორც კი რამე გამოჩნდება.')}
        >
          <Button>{display.t('Add a transaction', 'ტრანზაქციის დამატება')}</Button>
        </EmptyState>
      </Card>
    </Section>
  );
}

function IconSection() {
  const display = useDisplay();
  return (
    <Section title={display.t('Icons', 'იკონები')}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {symbolNames.map((name) => (
          <div key={name} className="flex flex-col items-center gap-2 rounded-md bg-surface p-3 text-ink">
            <Icon name={name} size={24} />
            <span className="w-full truncate text-center text-[10px] text-inkSoft" title={name}>
              {name}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
