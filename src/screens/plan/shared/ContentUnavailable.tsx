import { Icon } from '../../../design/index.ts';

/** A centred symbol and title for content that isn't there, like SwiftUI's ContentUnavailableView. */
export function ContentUnavailable({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="text-inkMuted">
        <Icon name={icon} size={48} />
      </span>
      <h2 className="type-title3 text-ink">{title}</h2>
    </div>
  );
}
