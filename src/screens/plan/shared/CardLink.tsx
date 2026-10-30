import { Icon } from '../../../design/index.ts';
import { Link } from '../../../layout/router/Link.tsx';

interface CardLinkProps {
  to: string;
  /** Leading SF Symbol. */
  icon: string;
  title: string;
}

/**
 * A full-width card that navigates, its label centred (iOS: a `Label` in `.card(padding: 0)` with a 54pt height),
 * e.g. "Plan a new journey" or "All transactions".
 */
export function CardLink({ to, icon, title }: CardLinkProps) {
  return (
    <Link
      to={to}
      className="type-headline pressable flex min-h-[54px] w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-center text-ink"
    >
      <Icon name={icon} size={18} />
      {title}
    </Link>
  );
}
