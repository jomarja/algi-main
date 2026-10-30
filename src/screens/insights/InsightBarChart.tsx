import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, palette, useReducedMotion } from '../../design/index.ts';
import type { InsightContent, Money } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { ChartFigure } from '../plan/shared/ChartFigure.tsx';
import { insightBarRows } from './insightsModel.ts';

/** Beyond this many bars, x-axis labels thin out instead of overlapping. */
const ALL_LABELS_LIMIT = 6;

/** The figures behind an insight as bars, the highlighted one in full colour, each labelled with its amount. */
export function InsightBarChart({ content }: { content: InsightContent }) {
  const display = useDisplay();
  const reduceMotion = useReducedMotion();
  const rows = insightBarRows(content.bars, (value: Money) => display.money(value, { precision: 'whole' }));
  const tint = palette[content.tint];

  return (
    <Card>
      <ChartFigure label={content.title} data={rows.map((row) => ({ id: row.id, label: row.label, value: row.valueLabel }))}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rows} margin={{ top: 22, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="id"
              tickFormatter={(id: string) => rows.find((row) => row.id === id)?.label ?? ''}
              interval={rows.length > ALL_LABELS_LIMIT ? 'preserveStartEnd' : 0}
              tick={{ fill: palette.inkSoft, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: palette.line }}
            />
            <YAxis hide domain={[0, 'dataMax']} />
            <Bar dataKey="value" radius={8} maxBarSize={56} isAnimationActive={!reduceMotion}>
              {rows.map((row) => (
                <Cell key={row.id} fill={tint} fillOpacity={row.isHighlighted ? 1 : 0.28} />
              ))}
              <LabelList dataKey="valueLabel" position="top" fill={palette.ink} fontSize={12} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
    </Card>
  );
}
