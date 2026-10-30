import { Icon } from '../../design/index.ts';

interface ContentUnavailableProps {
  icon: string;
  title: string;
  message?: string;
}

/** SwiftUI's ContentUnavailableView: a large grey symbol, a title, and an optional hint. */
export function ContentUnavailable({ icon, title, message }: ContentUnavailableProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span aria-hidden className="mb-2 text-inkMuted">
        <Icon name={icon} size={44} />
      </span>
      <p className="type-title3 text-ink">{title}</p>
      {message && <p className="type-subheadline text-inkSoft">{message}</p>}
    </div>
  );
}
