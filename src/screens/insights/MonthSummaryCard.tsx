import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Icon, Overline, cx, palette, useReducedMotion } from '../../design/index.ts';
import { addMonths, monthSpendingChange } from '../../engine/index.ts';
import type { FinanceSummary, Money } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { ChartFigure } from '../plan/shared/ChartFigure.tsx';
import { dailySpendingRows } from './insightsModel.ts';
import type { DailyBarRow } from './insightsModel.ts';

interface MonthSummaryCardProps {
  finance: FinanceSummary;
  /** Last month's total, when the bank data reaches back that far. */
  previousMonthSpending: Money | null;
}

/** This month's spending, how it compares with last month, and a bar per day (InsightsView.swift `monthSummary`). */
export function MonthSummaryCard({ finance, previousMonthSpending }: MonthSummaryCardProps) {
  const display = useDisplay();
  const change = monthSpendingChange(finance.monthlySpending, previousMonthSpending);
  const previousName = display.date(addMonths(finance.now, -1), 'month');
  const rows = dailySpendingRows(finance.dailySpending(finance.currentMonth));

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-mintPale p-5">
      <Overline as="h2" tone="mintDark">
        {display.t(`Total spending · ${display.date(finance.now, 'month')}`, `ჯამური ხარჯი · ${display.date(finance.now, 'month')}`)}
      </Overline>
      <p className="type-display text-ink">{display.money(finance.monthlySpending, { precision: 'whole' })}</p>
      {change && (
        <p className={cx('type-footnote flex items-center gap-1.5 font-semibold', change.isLower ? 'text-mintDark' : 'text-amberDeep')}>
          <Icon name={change.isLower ? 'arrow.down' : 'arrow.up'} size={13} />
          {change.isLower
            ? display.t(`${change.percent}% less than ${previousName}`, `${previousName}ზე ${change.percent}%-ით ნაკლები`)
            : display.t(`${change.percent}% more than ${previousName}`, `${previousName}ზე ${change.percent}%-ით მეტი`)}
        </p>
      )}
      <DailySpendingChart rows={rows} />
      <div className="type-caption flex items-center justify-between gap-2 text-inkSoft">
        <span>{display.date(finance.currentMonth.start, 'dayMonth')}</span>
        <span className="text-center">{display.t('Rent and bills excluded', 'ქირა და კომუნალურები არ შედის')}</span>
        <span>{display.date(finance.now, 'dayMonth')}</span>
      </div>
    </section>
  );
}

function DailySpendingChart({ rows }: { rows: readonly DailyBarRow[] }) {
  const display = useDisplay();
  const reduceMotion = useReducedMotion();

  return (
    <ChartFigure label={display.t('Daily spending this month, excluding rent and bills', 'ამ თვის დღიური ხარჯი, ქირისა და კომუნალურების გარეშე')}>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={[...rows]} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
          <XAxis dataKey="time" hide />
          <YAxis hide domain={[0, 'dataMax']} />
          <Bar dataKey="value" radius={3} isAnimationActive={!reduceMotion}>
            {rows.map((row) => (
              <Cell key={row.time} fill={row.isBusiest ? palette.ink : palette.mint} fillOpacity={row.isBusiest ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
