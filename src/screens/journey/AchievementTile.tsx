import { Card, Icon, cx, palette } from '../../design/index.ts';
import { isEarned, round } from '../../engine/index.ts';
import type { Achievement } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { RingBadge } from '../plan/shared/RingBadge.tsx';

/** One achievement (RewardsSection.swift `AchievementTile`): a progress ring around its symbol, and how far along it is. */
export function AchievementTile({ achievement }: { achievement: Achievement }) {
  const display = useDisplay();
  const earned = isEarned(achievement);
  const title = display.text(achievement.title);
  const percent = `${round(achievement.progress * 100)}%`;

  return (
    <Card background={earned ? 'surface' : 'cream'} className="flex min-h-[150px] flex-col items-start gap-2">
      <RingBadge value={achievement.progress} tint={achievement.tint} size={46} lineWidth={4} label={`${title}, ${percent}`}>
        <span style={{ color: palette[earned ? achievement.tint : 'inkMuted'] }}>
          <Icon name={achievement.icon} size={17} />
        </span>
      </RingBadge>
      <h3 className={cx('type-subheadline font-bold', earned ? 'text-ink' : 'text-inkSoft')}>{title}</h3>
      <p className="type-caption text-inkSoft">{display.text(achievement.detail)}</p>
      {!earned && (
        <p className="type-caption font-semibold" style={{ color: palette[achievement.tint] }}>
          {percent}
        </p>
      )}
    </Card>
  );
}
