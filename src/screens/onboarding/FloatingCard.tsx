import type { ReactNode } from 'react';
import { FloatingOnCoins } from '../../design/index.ts';

interface FloatingCardProps {
  /** Position among the floating cards; picks the bob period. */
  index: number;
  hopTrigger?: number;
  shakeTrigger?: number;
  /** Off: the content renders as is, without the card or the motion (the Settings editor). */
  isActive?: boolean;
  children: ReactNode;
}

/** A paper card bobbing on the coin sea, readable over the moving coins (`floatingCard()` in PersonalInfoView). */
export function FloatingCard({ index, hopTrigger, shakeTrigger, isActive = true, children }: FloatingCardProps) {
  if (!isActive) return <>{children}</>;
  return (
    <FloatingOnCoins index={index} hopTrigger={hopTrigger} shakeTrigger={shakeTrigger}>
      <div className="rounded-lg bg-paper p-4 shadow-[0_6px_10px_rgba(122,78,0,0.25)]">{children}</div>
    </FloatingOnCoins>
  );
}
