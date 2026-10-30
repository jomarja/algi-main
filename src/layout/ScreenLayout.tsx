import type { ReactNode } from 'react';
import { cx } from '../design/cx.ts';
import { NavigationHeader } from '../design/NavigationHeader.tsx';

const widths = {
  /** Forms and onboarding steps. */
  narrow: 'max-w-[480px]',
  /** Most screens: a readable column. */
  regular: 'max-w-[720px]',
  /** Dashboards that switch to two columns from the `xl` breakpoint (see DashboardColumns). */
  wide: 'max-w-[1120px]',
} as const;

export interface ScreenLayoutProps {
  title: string;
  /** 'large' for tab roots, 'inline' for pushed screens, 'hidden' when the screen draws its own header (Home). */
  titleDisplay?: 'large' | 'inline' | 'hidden';
  /** Where Back goes without history; defaults to the parent route. `false` hides Back. */
  back?: string | false;
  leading?: ReactNode;
  trailing?: ReactNode;
  width?: keyof typeof widths;
  children: ReactNode;
}

/**
 * The frame of a screen: a sticky navigation bar, then the content in a centred column with the iOS page margins
 * (20px on phones, 32px from the laptop breakpoint) and 20px between sections. The window is the scroll container.
 */
export function ScreenLayout({
  title,
  titleDisplay = 'inline',
  back,
  leading,
  trailing,
  width = 'regular',
  children,
}: ScreenLayoutProps) {
  const isHeaderHidden = titleDisplay === 'hidden';
  return (
    <div className={cx('mx-auto w-full', widths[width])}>
      {isHeaderHidden ? (
        <h1 className="sr-only">{title}</h1>
      ) : (
        <NavigationHeader title={title} titleDisplay={titleDisplay} back={back} leading={leading} trailing={trailing} />
      )}
      <div className={cx('flex flex-col gap-5 px-5 pb-8 md:px-8', isHeaderHidden && 'pt-safe')}>{children}</div>
    </div>
  );
}

/** Main content and a side column, side by side from the wide breakpoint (1200px) and stacked below it. */
export function DashboardColumns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      <div className="flex min-w-0 flex-col gap-5">{aside}</div>
    </div>
  );
}
