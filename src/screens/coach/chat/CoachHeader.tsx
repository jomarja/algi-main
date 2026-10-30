import { useEffect, useState } from 'react';
import { cx, MascotAvatar } from '../../../design/index.ts';
import { useDisplay } from '../../../state/AppStateProvider.tsx';

function useIsScrolled(): boolean {
  const [isScrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return isScrolled;
}

/**
 * The coach's navigation bar (CoachView's principal toolbar item): Luka's avatar, the title, and the period being
 * analysed. Styled like NavigationHeader — sticky, blurred with a hairline once the page scrolls.
 */
export function CoachHeader({ subtitle }: { subtitle: string }) {
  const display = useDisplay();
  const isScrolled = useIsScrolled();

  return (
    <header
      className={cx(
        'sticky top-0 z-20 border-b pt-safe transition-[background-color,border-color] duration-200',
        isScrolled ? 'border-line bg-paper/85 backdrop-blur-xl backdrop-saturate-150' : 'border-transparent bg-paper',
      )}
    >
      <div className="flex min-h-[52px] items-center justify-center gap-2 px-5 md:px-8">
        <MascotAvatar size={30} decorative />
        <div className="flex min-w-0 flex-col">
          <h1 className="type-subheadline truncate font-bold text-ink">{display.t('Your AI Coach', 'შენი AI ქოუჩი')}</h1>
          <p className="type-caption truncate text-inkSoft">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
