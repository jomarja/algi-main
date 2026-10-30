import { Icon } from '../../../design/index.ts';
import { Link } from '../../../layout/router/Link.tsx';

interface HeaderLinkProps {
  to: string;
  icon?: string;
  /** Visible text; icon-only links need `label` instead. */
  title?: string;
  label?: string;
}

/** A navigation bar item that goes somewhere, e.g. "+" for a new journey (iOS toolbar NavigationLink). */
export function HeaderLink({ to, icon, title, label }: HeaderLinkProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="type-body pressable-dim flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2 text-ink"
    >
      {icon && <Icon name={icon} size={20} />}
      {title}
    </Link>
  );
}
