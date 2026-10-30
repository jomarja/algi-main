import { Icon, MascotView } from '../../design/index.ts';
import type { MascotPose } from '../../design/index.ts';
import { Link } from '../../layout/router/Link.tsx';
import { ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { GOAL_PLANNER_PATH } from './goalPlanner/plannerQuery.ts';
import { CardLink } from './shared/CardLink.tsx';
import { Intro } from './shared/Intro.tsx';

interface Tool {
  readonly id: string;
  readonly to: string;
  readonly pose: MascotPose;
  readonly title: string;
  readonly detail: string;
}

/** Decision tools (PlanView.swift): try ideas before committing, with the numbers behind every answer. */
export default function PlanScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const suggestionCount = store.proactiveCoach(display).recommendations.length;
  const savedPlanCount = store.getState().savedPlans.length;

  const tools: readonly Tool[] = [
    {
      id: 'goal-planner',
      to: GOAL_PLANNER_PATH,
      pose: 'savings',
      title: display.t('Plan a goal', 'მიზნის დაგეგმვა'),
      detail: display.t('Describe it in your words. Get three ways to reach it.', 'აღწერე შენი სიტყვებით. მიიღე მისი მიღწევის სამი გზა.'),
    },
    {
      id: 'what-if',
      to: '/plan/what-if',
      pose: 'overview',
      title: display.t('What if…', 'რა მოხდება, თუ…'),
      detail: display.t(
        'See how a change affects savings, spending, and debt.',
        'ნახე, როგორ იმოქმედებს ცვლილება დანაზოგზე, ხარჯზე და ვალზე.',
      ),
    },
    {
      id: 'loans',
      to: '/plan/loans',
      pose: 'insight',
      title: display.t('Compare loans', 'სესხების შედარება'),
      detail: display.t('The full cost of an offer, not just its rate.', 'შეთავაზების სრული ფასი და არა მხოლოდ განაკვეთი.'),
    },
    {
      id: 'budget',
      to: '/plan/budget',
      pose: 'assistant',
      title: display.t('Essentials & flexible', 'აუცილებელი და მოქნილი'),
      detail: display.t("Choose what's protected. See upcoming bills.", 'აირჩიე, რა არის დაცული. ნახე მომავალი გადასახადები.'),
    },
    {
      id: 'recommendations',
      to: '/coach/recommendations',
      pose: 'avatar',
      title: display.t("Luka's suggestions", 'ლუკას რჩევები'),
      detail: display.t(`${suggestionCount} things worth a look right now.`, `ახლა ${suggestionCount} რამ ღირს ყურადღებად.`),
    },
  ];

  return (
    <ScreenLayout title={display.t('Plan', 'გეგმა')} titleDisplay="large" width="wide">
      <Intro>
        {display.t(
          'Try ideas before you commit. Luka shows the numbers behind every answer.',
          'სცადე იდეები გადაწყვეტილებამდე. ლუკა ყველა პასუხის უკან რიცხვებს გაჩვენებს.',
        )}
      </Intro>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.id} className="flex">
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
      {savedPlanCount > 0 && (
        <CardLink
          to="/plan/saved-plans"
          icon="square.split.2x1"
          title={display.t(`Compare saved plans (${savedPlanCount})`, `შენახული გეგმების შედარება (${savedPlanCount})`)}
        />
      )}
    </ScreenLayout>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link to={tool.to} className="pressable flex w-full items-center gap-4 rounded-lg border border-line bg-surface p-3">
      <span className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md bg-mintPale">
        <MascotView pose={tool.pose} decorative className="h-full w-full" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-headline text-ink">{tool.title}</span>
        <span className="type-footnote text-inkSoft">{tool.detail}</span>
      </span>
      <span className="text-inkMuted">
        <Icon name="chevron.right" size={13} />
      </span>
    </Link>
  );
}
