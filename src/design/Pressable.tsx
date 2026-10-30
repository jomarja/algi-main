import type { ReactNode } from 'react';
import { Link } from '../layout/router/Link.tsx';

export interface PressableTarget {
  /** Navigates in-app when set; the element renders as a link. */
  to?: string;
  /** Runs on press when there's no `to`; the element renders as a button. */
  onClick?: () => void;
}

interface PressableProps extends PressableTarget {
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}

/**
 * Renders a link, a button, or a plain container depending on what the content does, so rows and cards
 * can be tappable without each screen choosing the element (SwiftUI's NavigationLink / Button around a view).
 */
export function Pressable({ to, onClick, className, children, 'aria-label': ariaLabel }: PressableProps) {
  if (to !== undefined) {
    return (
      <Link to={to} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-label={ariaLabel}>
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}
