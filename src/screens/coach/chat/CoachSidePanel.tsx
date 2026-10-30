import { Card, DetailRow, Icon, MascotView, Overline, palette, ProgressBar, SectionHeader } from '../../../design/index.ts';
import {
  GoalProjection,
  type BudgetStatus,
  type CoachQuestion,
  type Money,
  type PaletteToken,
  type ProactiveRecommendation,
} from '../../../engine/index.ts';
import { Link } from '../../../layout/router/Link.tsx';
import { useAppStore, useDisplay } from '../../../state/AppStateProvider.tsx';
import { recommendationPath, RECOMMENDATIONS_PATH } from '../recommendations/destinations.ts';
import { toneBackgrounds } from '../recommendations/presentation.ts';
import type { SuggestedQuestion } from './Composer.tsx';

const budgetTints: Readonly<Record<BudgetStatus, PaletteToken>> = { comfortable: 'mint', nearLimit: 'amber', over: 'coral' };

/** How many of Luka's suggestions the panel previews. */
const previewCount = 3;

interface CoachSidePanelProps {
  suggestions: readonly SuggestedQuestion[];
  isBusy: boolean;
  onAsk(question: CoachQuestion): void;
  recommendations: readonly ProactiveRecommendation[];
}

function SuggestedQuestionList({ suggestions, isBusy, onAsk }: Omit<CoachSidePanelProps, 'recommendations'>) {
  const display = useDisplay();
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={display.t('Suggested questions', 'შემოთავაზებული კითხვები')} level={3} />
      <ul className="flex flex-col gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.question}>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onAsk(suggestion.question)}
              className="type-subheadline pressable-dim flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left font-semibold text-ink transition-colors hover:bg-cream/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion.title}
              <Icon name="arrow.up.circle" size={18} className="text-mintDark" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The figures Luka's answers lean on, as the app computes them. */
function KeyFigures() {
  const store = useAppStore();
  const display = useDisplay();
  if (!store.hasFinancialData) return null;

  const formatWhole = (value: Money) => display.money(value, { precision: 'whole' });
  const { allowance, finance, primaryGoal } = store;
  const month = finance.monthlyPlanProgress;
  const goalProgress = primaryGoal ? new GoalProjection(primaryGoal, store.now).progress : null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={display.t('Your numbers', 'შენი რიცხვები')} level={3} />
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Overline>{display.t('Today you can spend about', 'დღეს შეგიძლია დახარჯო დაახლოებით')}</Overline>
          <p className="type-title text-ink">{formatWhole(allowance.today)}</p>
          <DetailRow title={display.t('Left this week', 'ამ კვირაში დარჩა')} value={formatWhole(allowance.weeklyRemaining)} />
        </div>
        <div className="flex flex-col gap-2">
          <DetailRow title={display.t('Spent this month', 'ამ თვეში დახარჯული')} value={formatWhole(month.spent)} />
          <ProgressBar
            value={month.fractionUsed}
            tint={budgetTints[month.status]}
            label={display.t('Monthly plan used', 'თვიური გეგმის გამოყენება')}
          />
          <p className="type-caption text-inkSoft">
            {display.t(`of ${formatWhole(month.limit)} planned`, `დაგეგმილი ${formatWhole(month.limit)}-დან`)}
          </p>
        </div>
        {primaryGoal && goalProgress !== null && (
          <div className="flex flex-col gap-2">
            <DetailRow
              title={display.text(primaryGoal.name)}
              value={`${formatWhole(primaryGoal.saved)} / ${formatWhole(primaryGoal.target)}`}
            />
            <ProgressBar value={goalProgress} label={display.text(primaryGoal.name)} />
          </div>
        )}
      </Card>
    </section>
  );
}

function SuggestionPreview({ recommendations }: { recommendations: readonly ProactiveRecommendation[] }) {
  const display = useDisplay();
  if (recommendations.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={display.t("Luka's suggestions", 'ლუკას რჩევები')}
        actionTitle={display.t('See all', 'ყველა')}
        actionTo={RECOMMENDATIONS_PATH}
        level={3}
      />
      <ul className="flex flex-col gap-2">
        {recommendations.slice(0, previewCount).map((recommendation) => (
          <li key={recommendation.id}>
            <Link
              to={recommendationPath({ source: 'local', id: recommendation.id })}
              className="pressable flex items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-colors hover:bg-cream/60"
            >
              <MascotView
                pose={recommendation.pose}
                decorative
                className="h-11 w-11 shrink-0 rounded-sm"
                style={{ backgroundColor: palette[toneBackgrounds[recommendation.tone]] }}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="type-footnote line-clamp-2 font-bold text-ink">{recommendation.title}</span>
                <span className="type-caption font-semibold text-mintDark">{recommendation.nextStep}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Beside the chat on wide screens: the suggested questions, the user's key figures, and Luka's top suggestions. */
export function CoachSidePanel({ suggestions, isBusy, onAsk, recommendations }: CoachSidePanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {suggestions.length > 0 && <SuggestedQuestionList suggestions={suggestions} isBusy={isBusy} onAsk={onAsk} />}
      <KeyFigures />
      <SuggestionPreview recommendations={recommendations} />
    </div>
  );
}
