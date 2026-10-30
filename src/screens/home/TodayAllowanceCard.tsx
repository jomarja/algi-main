import { CategoryIcon, Icon } from '../../design/index.ts';
import { CATEGORY_META } from '../../engine/index.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { PressableCard } from './PressableCard.tsx';

/** "How much can I safely spend today?" An indicative guide from the week's plan, never the bank balance (TodayAllowance.swift). */
export function TodayAllowanceCard({ onOpen }: { onOpen: () => void }) {
  const store = useAppStore();
  const display = useDisplay();
  const allowance = store.allowance;
  const next = store.nextEssentialPayment;
  const nextMeta = next && CATEGORY_META[next.category];

  return (
    <PressableCard onClick={onOpen} className="flex-col gap-3">
      <span className="flex items-baseline justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="type-subheadline text-inkSoft">{display.t('Today you can spend about', 'დღეს შეგიძლია დახარჯო დაახლოებით')}</span>
          <span className="type-display text-ink">{display.money(allowance.today, { precision: 'whole' })}</span>
        </span>
        <span className="text-inkMuted">
          <Icon name="chevron.right" size={14} />
        </span>
      </span>

      <span className="grid grid-cols-2 gap-3">
        <AllowancePill
          title={display.t('Flexible this week', 'მოქნილი ამ კვირაში')}
          value={display.money(allowance.flexibleLeft, { precision: 'whole' })}
          tone="text-mintDark"
        />
        <AllowancePill
          title={display.t('Kept for groceries & transport', 'სურსათისა და ტრანსპორტისთვის')}
          value={display.money(allowance.protectedForEssentials, { precision: 'whole' })}
          tone="text-lavender"
        />
      </span>

      {next && nextMeta && (
        <span className="flex items-center gap-2">
          <CategoryIcon icon={nextMeta.icon} tint={nextMeta.tint} background={nextMeta.background} size={28} />
          <span className="type-footnote text-ink">
            {display.t(
              `Next: ${display.text(next.title)} · ${display.money(next.amount, { precision: 'whole' })} · ${display.date(next.dueDate, 'dayMonth')} — already set aside`,
              `შემდეგი: ${display.text(next.title)} · ${display.money(next.amount, { precision: 'whole' })} · ${display.date(next.dueDate, 'dayMonth')} — უკვე გადადებულია`,
            )}
          </span>
        </span>
      )}

      <span className="type-caption text-inkMuted">
        {display.t('A guide from your plan, not your bank balance.', 'ეს გეგმის მითითებაა და არა ბანკის ბალანსი.')}
      </span>
    </PressableCard>
  );
}

function AllowancePill({ title, value, tone }: { title: string; value: string; tone: 'text-mintDark' | 'text-lavender' }) {
  return (
    <span className="flex flex-col gap-0.5 rounded-sm bg-cream p-3">
      <span className="type-caption line-clamp-2 text-inkSoft">{title}</span>
      <span className={`type-headline ${tone}`}>{value}</span>
    </span>
  );
}
