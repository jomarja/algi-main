import { Pressable } from './Pressable.tsx';
import type { PressableTarget } from './Pressable.tsx';

/** The "A" app mark with the Algi wordmark. */
export function BrandMark({ showsWordmark = true }: { showsWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label="Algi">
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink font-rounded text-[17px] font-extrabold text-white"
      >
        A
      </span>
      {showsWordmark && (
        <span aria-hidden className="font-rounded text-[22px] font-extrabold leading-none text-ink">
          Algi
        </span>
      )}
    </span>
  );
}

interface ProfileBadgeProps extends PressableTarget {
  initials: string;
  /** e.g. "Profile and settings". */
  label: string;
  size?: number;
}

/** The user's initials in a dark circle; opens the profile. */
export function ProfileBadge({ initials, label, size = 44, to, onClick }: ProfileBadgeProps) {
  return (
    <Pressable
      to={to}
      onClick={onClick}
      aria-label={label}
      className="pressable-dim flex shrink-0 items-center justify-center rounded-full bg-ink font-rounded text-[14px] font-extrabold text-white"
    >
      <span aria-hidden className="flex items-center justify-center" style={{ width: size, height: size }}>
        {initials}
      </span>
    </Pressable>
  );
}
