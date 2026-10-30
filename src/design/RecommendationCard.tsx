import type { RecommendationTone } from '../engine/presentation.ts';
import { Link } from '../layout/router/Link.tsx';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';
import { MascotView } from './mascot/MascotView.tsx';
import type { MascotPose } from './mascot/assets.ts';
import { Overline } from './Typography.tsx';

const toneBackgrounds: Record<RecommendationTone, string> = {
  nextStep: 'bg-amberPale',
  positive: 'bg-mintPale',
  attention: 'bg-coralPale',
};

interface RecommendationCardProps {
  overline: string;
  title: string;
  message: string;
  pose?: MascotPose;
  tone?: RecommendationTone;
  /** e.g. "Why am I seeing this?" */
  linkTitle?: string;
  /** Makes the whole card a link; the link title then reads as part of it. */
  to?: string;
  /** Makes only the link title a button. Ignored when `to` is set. */
  onLinkClick?: () => void;
  className?: string;
}

/** The AI coach's recommendation: what to do, why, and a way to dig deeper, with Luka on the right. */
export function RecommendationCard({
  overline,
  title,
  message,
  pose = 'insight',
  tone = 'nextStep',
  linkTitle,
  to,
  onLinkClick,
  className,
}: RecommendationCardProps) {
  const linkLabel = linkTitle && (
    <span className="type-footnote inline-flex min-h-[44px] items-center gap-1 font-bold text-ink">
      {linkTitle}
      <Icon name="arrow.right" size={13} />
    </span>
  );

  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-5 pl-5">
        <Overline tone="ink" icon="sparkles">
          {overline}
        </Overline>
        <h3 className="type-title3 text-ink">{title}</h3>
        <p className="type-footnote text-inkSoft">{message}</p>
        {linkLabel && !to && onLinkClick ? (
          <button type="button" onClick={onLinkClick} className="pressable-dim self-start text-left">
            {linkLabel}
          </button>
        ) : (
          linkLabel
        )}
      </div>
      <MascotView pose={pose} decorative className="h-32 w-28 shrink-0 self-end pr-1" />
    </>
  );

  const cardClass = cx('flex w-full items-end overflow-hidden rounded-xl text-left', toneBackgrounds[tone], className);

  if (to !== undefined) {
    return (
      <Link to={to} className={cx(cardClass, 'pressable')}>
        {body}
      </Link>
    );
  }
  return <div className={cardClass}>{body}</div>;
}
