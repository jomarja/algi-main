import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { palette, useReducedMotion } from '../../design/index.ts';
import { gel, majorUnits, SCENARIO_META } from '../../engine/index.ts';
import type { GoalProjection, GoalScenario, SavingsGoal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { ChartFigure } from '../plan/shared/ChartFigure.tsx';
import { projectionChartRows, projectionTicks } from './projectionChart.ts';

const CHART_HEIGHT = 220;
const axisTick = { fill: palette.inkSoft, fontSize: 12 };

interface GoalProjectionChartProps {
  goal: SavingsGoal;
  projection: GoalProjection;
  scenarios: readonly GoalScenario[];
}

/** The three scenarios as lines toward a dashed target line, styled like the iOS Swift Chart. */
export function GoalProjectionChart({ goal, projection, scenarios }: GoalProjectionChartProps) {
  const display = useDisplay();
  const reduceMotion = useReducedMotion();
  const rows = projectionChartRows(projection, scenarios);
  const ticks = projectionTicks(rows);
  const wholeMoney = (value: number) => display.money(gel(value), { precision: 'whole' });

  return (
    <div className="flex flex-col gap-3">
      <ChartFigure label={display.t('Savings projection for three scenarios', 'დანაზოგის პროგნოზი სამი სცენარისთვის')}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={rows} margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={palette.line} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={(time: number) => display.date(new Date(time), 'monthShort')}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: palette.line }}
            />
            <YAxis
              orientation="right"
              width={64}
              domain={[0, 'auto']}
              tickFormatter={wholeMoney}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine
              y={majorUnits(goal.target)}
              ifOverflow="extendDomain"
              stroke={palette.inkMuted}
              strokeDasharray="4 4"
              label={{
                value: display.t(`Target ${wholeMoney(majorUnits(goal.target))}`, `მიზანი ${wholeMoney(majorUnits(goal.target))}`),
                position: 'insideLeft',
                fill: palette.inkSoft,
                fontSize: 12,
                dy: -10,
              }}
            />
            {scenarios.map((scenario) => (
              <Line
                key={scenario.kind}
                dataKey={scenario.kind}
                type="monotone"
                stroke={palette[SCENARIO_META[scenario.kind].tint]}
                strokeWidth={3}
                strokeLinecap="round"
                dot={false}
                activeDot={false}
                isAnimationActive={!reduceMotion}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-hidden>
        {scenarios.map((scenario) => (
          <li key={scenario.kind} className="type-caption flex items-center gap-1.5 text-inkSoft">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette[SCENARIO_META[scenario.kind].tint] }} />
            {display.text(SCENARIO_META[scenario.kind].title)}
          </li>
        ))}
      </ul>
    </div>
  );
}
