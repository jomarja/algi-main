import type { TagTone } from '../engine/presentation.ts';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

const toneClasses: Record<TagTone, string> = {
  neutral: 'bg-cream text-inkSoft',
  positive: 'bg-mintPale text-mintDark',
  attention: 'bg-amberPale text-amberDeep',
  estimate: 'bg-lavenderPale text-lavender',
};

interface TagProps {
  text: string;
  tone?: TagTone;
  icon?: string;
  className?: string;
}

/** A small pill label, e.g. "Estimate", "Sample data", "Premium". */
export function Tag({ text, tone = 'neutral', icon, className }: TagProps) {
  return (
    <span
      className={cx(
        'type-caption inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 font-semibold',
        toneClasses[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={12} />}
      {text}
    </span>
  );
}
