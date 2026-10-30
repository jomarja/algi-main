import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { DetailRow, Icon, ListItem, ListSection, SegmentedPicker, Tag, cx, palette } from '../../design/index.ts';
import {
  CURRENCY_SYMBOLS,
  GOAL_ICON_META,
  GOAL_ICONS,
  GOAL_PRIORITIES,
  GOAL_PRIORITY_TITLES,
  GOAL_STATUS_META,
  GoalProjection,
  isoDay,
  lt,
  parseIsoDay,
  startOfDay,
} from '../../engine/index.ts';
import type { GoalDraftFields, GoalIcon, LocalizedText, SavingsGoal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

const ICON_NAMES: Readonly<Record<GoalIcon, LocalizedText>> = {
  shield: lt('Safety cushion', 'ფინანსური ბალიში'),
  home: lt('Home', 'სახლი'),
  travel: lt('Travel', 'მოგზაურობა'),
  laptop: lt('Laptop', 'ლეპტოპი'),
  car: lt('Car', 'მანქანა'),
  gift: lt('Gift', 'საჩუქარი'),
  loan: lt('Loan', 'სესხი'),
};

interface GoalFormProps {
  fields: GoalDraftFields;
  onChange: (fields: GoalDraftFields) => void;
  /** The goal as entered so far, or null while it's incomplete; drives Luka's quick plan. */
  draft: SavingsGoal | null;
  now: Date;
}

/** The goal fields as an inset-grouped form (CreateGoalSheet.swift), shared by creating and editing a goal. */
export function GoalForm({ fields, onChange, draft, now }: GoalFormProps) {
  const display = useDisplay();
  const update = (changes: Partial<GoalDraftFields>) => onChange({ ...fields, ...changes });

  return (
    <div className="flex flex-col gap-6">
      <ListSection>
        <ListItem>
          <input
            value={fields.name}
            onChange={(event) => update({ name: event.target.value })}
            placeholder={display.t('Goal name, e.g. New laptop', 'მიზნის სახელი, მაგ. ახალი ლეპტოპი')}
            aria-label={display.t('Goal name', 'მიზნის სახელი')}
            autoComplete="off"
            className="type-body min-h-[28px] w-full bg-transparent text-ink outline-none placeholder:text-inkMuted"
          />
        </ListItem>
        <ListItem>
          <IconPicker value={fields.icon} onChange={(icon) => update({ icon })} />
        </ListItem>
      </ListSection>

      <ListSection>
        <AmountRow label={display.t('Target amount', 'სამიზნე თანხა')} value={fields.targetText} onChange={(targetText) => update({ targetText })} />
        <ListItem>
          <label className="flex min-h-[28px] items-center justify-between gap-3">
            <span className="type-body text-ink">{display.t('Target date', 'ვადა')}</span>
            <input
              type="date"
              min={isoDay(now)}
              value={isoDay(fields.targetDate)}
              onChange={(event) => {
                const date = parseIsoDay(event.target.value);
                if (date && date.getTime() >= startOfDay(now).getTime()) update({ targetDate: date });
              }}
              className="type-body rounded-sm bg-cream px-2 py-1 text-ink"
            />
          </label>
        </ListItem>
        <AmountRow label={display.t('Already saved', 'უკვე დაზოგილი')} value={fields.savedText} onChange={(savedText) => update({ savedText })} />
        <AmountRow
          label={display.t('Monthly contribution (optional)', 'თვის შენატანი (არასავალდებულო)')}
          value={fields.monthlyText}
          onChange={(monthlyText) => update({ monthlyText })}
        />
      </ListSection>

      <ListSection header={display.t('Priority', 'პრიორიტეტი')}>
        <ListItem>
          <SegmentedPicker
            options={GOAL_PRIORITIES}
            value={fields.priority}
            onChange={(priority) => update({ priority })}
            title={(priority) => display.text(GOAL_PRIORITY_TITLES[priority])}
            label={display.t('Priority', 'პრიორიტეტი')}
          />
        </ListItem>
      </ListSection>

      {draft && <QuickPlan goal={draft} now={now} />}
    </div>
  );
}

function AmountRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <ListItem>
      <label className="flex min-h-[28px] items-center gap-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          aria-label={label}
          autoComplete="off"
          className="type-body min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-inkMuted"
        />
        <span aria-hidden className="type-body text-inkSoft">
          {CURRENCY_SYMBOLS.GEL}
        </span>
      </label>
    </ListItem>
  );
}

const arrowSteps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** The goal symbols as a radio group: arrows move between them, the selected one gets an ink outline. */
function IconPicker({ value, onChange }: { value: GoalIcon; onChange: (icon: GoalIcon) => void }) {
  const display = useDisplay();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(GOAL_ICONS.indexOf(value), 0);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.key in arrowSteps)) return;
    event.preventDefault();
    const index = (selectedIndex + arrowSteps[event.key] + GOAL_ICONS.length) % GOAL_ICONS.length;
    onChange(GOAL_ICONS[index]);
    buttons.current[index]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={display.t('Symbol', 'სიმბოლო')} onKeyDown={handleKeyDown} className="grid grid-cols-7 gap-1.5 py-1">
      {GOAL_ICONS.map((icon, index) => {
        const meta = GOAL_ICON_META[icon];
        const isSelected = icon === value;
        return (
          <button
            key={icon}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={display.text(ICON_NAMES[icon])}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(icon)}
            className={cx(
              'pressable flex aspect-square w-full max-w-[44px] items-center justify-center justify-self-center rounded-sm transition-shadow',
              isSelected && 'ring-2 ring-inset ring-ink',
            )}
            style={{ color: palette[meta.tint], backgroundColor: palette[meta.background] }}
          >
            <Icon name={meta.symbol} size={16} />
          </button>
        );
      })}
    </div>
  );
}

/** What the entered goal needs per month and week, and how the chosen contribution compares. */
function QuickPlan({ goal, now }: { goal: SavingsGoal; now: Date }) {
  const display = useDisplay();
  const projection = new GoalProjection(goal, now);
  const status = GOAL_STATUS_META[projection.status];

  return (
    <ListSection
      header={display.t("Luka's quick plan", 'ლუკას სწრაფი გეგმა')}
      footer={display.t('Estimates assume the same contribution every month.', 'შეფასება ითვალისწინებს ყოველთვიურად ერთნაირ შენატანს.')}
    >
      <ListItem>
        <div aria-live="polite" className="flex flex-col items-start gap-2">
          <div className="w-full">
            <DetailRow title={display.t('Needed per month', 'საჭიროა თვეში')} value={display.money(projection.requiredMonthly, { precision: 'whole' })} />
            <DetailRow title={display.t('Needed per week', 'საჭიროა კვირაში')} value={display.money(projection.requiredWeekly, { precision: 'whole' })} />
          </div>
          {goal.monthlyContribution.minorUnits > 0 && <Tag text={display.text(status.label)} tone={status.tone} />}
        </div>
      </ListItem>
    </ListSection>
  );
}
