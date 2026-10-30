import { CategoryIcon, Card, ProgressBar, SectionHeader } from '../../design/index.ts';
import { CATEGORY_META } from '../../engine/index.ts';
import type { CategoryTotal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { categoryShares } from './insightsModel.ts';

/** The five largest categories this month, each bar measured against the biggest (InsightsView.swift `categorySection`). */
export function CategoryBreakdown({ totals }: { totals: readonly CategoryTotal[] }) {
  const display = useDisplay();

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={display.t('By category', 'კატეგორიების მიხედვით')} />
      <Card>
        <ul className="flex flex-col gap-4">
          {categoryShares(totals).map(({ category, total, share }) => {
            const meta = CATEGORY_META[category];
            const title = display.text(meta.title);
            const amount = display.money(total, { precision: 'whole' });
            return (
              <li key={category} className="flex items-center gap-3">
                <CategoryIcon icon={meta.icon} tint={meta.tint} background={meta.background} size={36} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="type-subheadline flex items-baseline justify-between gap-3 font-semibold text-ink">
                    <span className="truncate">{title}</span>
                    <span className="shrink-0">{amount}</span>
                  </div>
                  <ProgressBar value={share} tint={meta.tint} height={6} label={`${title}, ${amount}`} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
