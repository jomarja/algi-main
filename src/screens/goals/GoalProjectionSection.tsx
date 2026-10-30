import { Card, Icon, SectionHeader, Tag, palette } from '../../design/index.ts';
import { REVISED_PLAN_EXTRA, SCENARIO_META } from '../../engine/index.ts';
import type { GoalProjection, GoalScenario, SavingsGoal } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { GoalProjectionChart } from './GoalProjectionChart.tsx';
import { reachesTargetOnTime } from './goalModel.ts';

interface GoalProjectionSectionProps {
  goal: SavingsGoal;
  projection: GoalProjection;
}

/** The estimate chart and the three scenarios behind it: current, conservative and a revised spending plan. */
export function GoalProjectionSection({ goal, projection }: GoalProjectionSectionProps) {
  const display = useDisplay();
  const scenarios = projection.scenarios(REVISED_PLAN_EXTRA);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader title={display.t('Projection', 'პროგნოზი')} />
        <Tag text={display.t('Estimate', 'შეფასება')} tone="estimate" />
      </div>
      <Card>
        <GoalProjectionChart goal={goal} projection={projection} scenarios={scenarios} />
      </Card>
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.kind} scenario={scenario} goal={goal} />
      ))}
      <p className="type-caption text-inkMuted">
        {display.t(
          "Projections assume contributions stay the same each month. They're estimates, not guarantees.",
          'პროგნოზი ითვალისწინებს, რომ შენატანი ყოველთვე იგივე დარჩება. ეს შეფასებაა და არა გარანტია.',
        )}
      </p>
    </section>
  );
}

function ScenarioCard({ scenario, goal }: { scenario: GoalScenario; goal: SavingsGoal }) {
  const display = useDisplay();
  const meta = SCENARIO_META[scenario.kind];
  const reaches = reachesTargetOnTime(scenario, goal);
  const monthly = display.money(scenario.monthlyContribution, { precision: 'whole' });
  const projected = display.money(scenario.projectedAtTargetDate, { precision: 'whole' });
  const completion = scenario.completionDate ? display.date(scenario.completionDate, 'monthYear') : null;

  return (
    <Card className="flex items-start gap-3">
      <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[meta.tint] }} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="type-subheadline font-semibold text-ink">{display.text(meta.title)}</h3>
        <p className="type-footnote text-inkSoft">
          {display.t(
            `${monthly} a month → about ${projected} by the target date`,
            `თვეში ${monthly} → ვადისთვის დაახლოებით ${projected}`,
          )}
        </p>
        {completion && (
          <p className="type-footnote text-inkSoft">
            {display.t(`Goal reached around ${completion}`, `მიზანი მიიღწევა დაახლოებით ${completion}-ში`)}
          </p>
        )}
      </div>
      <span className={reaches ? 'text-mint' : 'text-amberDeep'}>
        <Icon
          name={reaches ? 'checkmark.circle.fill' : 'clock'}
          size={20}
          label={
            reaches
              ? display.t('Reaches the goal on time', 'მიზანს დროულად მიაღწევს')
              : display.t('Reaches the goal later', 'მიზანს მოგვიანებით მიაღწევს')
          }
        />
      </span>
    </Card>
  );
}
