import { Icon, palette } from '../../design/index.ts';
import type { InsightContent } from '../../engine/index.ts';
import { buildPath } from '../../layout/router/matchPath.ts';
import { Link } from '../../layout/router/Link.tsx';

/** One thing Luka noticed, linking to the explanation (InsightsView.swift `InsightRow`). */
export function InsightRow({ content }: { content: InsightContent }) {
  return (
    <Link
      to={buildPath('/insights/:insightId', { insightId: content.kind })}
      className="pressable flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm"
        style={{ color: palette[content.tint], backgroundColor: palette[content.background] }}
      >
        <Icon name={content.icon} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-subheadline font-bold text-ink">{content.title}</span>
        <span className="type-footnote line-clamp-3 text-inkSoft">{content.summary}</span>
      </span>
      <span className="pt-1 text-inkMuted">
        <Icon name="chevron.right" size={13} />
      </span>
    </Link>
  );
}
