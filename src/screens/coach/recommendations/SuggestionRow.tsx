import { Icon, MascotView, palette } from '../../../design/index.ts';
import type { MascotPose, RecommendationTone } from '../../../engine/index.ts';
import { Link } from '../../../layout/router/Link.tsx';
import { toneBackgrounds } from './presentation.ts';

interface SuggestionRowProps {
  pose: MascotPose;
  tone: RecommendationTone;
  title: string;
  /** The next step, in mint (iOS `nextStep`). */
  nextStep: string;
  /** An extra line under the title, e.g. the monthly impact. */
  caption?: string;
  to: string;
}

/** One suggestion in the list (iOS RecommendationRow): Luka on the tone's colour, what he noticed, and the next step. */
export function SuggestionRow({ pose, tone, title, nextStep, caption, to }: SuggestionRowProps) {
  return (
    <Link
      to={to}
      className="pressable flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:bg-cream/40"
    >
      <MascotView
        pose={pose}
        decorative
        className="h-14 w-14 shrink-0 rounded-sm"
        style={{ backgroundColor: palette[toneBackgrounds[tone]] }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-subheadline font-bold text-ink">{title}</span>
        {caption && <span className="type-footnote text-inkSoft">{caption}</span>}
        <span className="type-footnote font-semibold text-mintDark">{nextStep}</span>
      </span>
      <Icon name="chevron.right" size={13} className="mt-1 shrink-0 text-inkMuted" />
    </Link>
  );
}
