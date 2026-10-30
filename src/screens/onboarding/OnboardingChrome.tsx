import type { ReactNode } from 'react';
import { cx, Icon, Overline } from '../../design/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

export const ONBOARDING_STEP_COUNT = 3;

interface OnboardingLayoutProps {
  topBar: ReactNode;
  /** Pinned to the bottom of the screen, like the iOS buttons under the scroll view. */
  actions: ReactNode;
  /** The coin-sea page: a translucent action bar with rounded top corners. */
  floating?: boolean;
  /** Space between content blocks: iOS Spacing.m (16) or Spacing.l (20). */
  spacing?: 'm' | 'l';
  /** Extra room above the content, e.g. for Luka to swim in. */
  contentClassName?: string;
  children: ReactNode;
}

/**
 * The frame of an onboarding step: top bar, scrolling content, and the actions pinned at the bottom.
 * A phone-width column, centred on laptops.
 */
export function OnboardingLayout({ topBar, actions, floating = false, spacing = 'm', contentClassName, children }: OnboardingLayoutProps) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pt-safe">
      {topBar}
      <div className={cx('relative flex flex-1 flex-col px-5 pb-5', spacing === 'm' ? 'gap-4' : 'gap-5', contentClassName)}>
        {children}
      </div>
      <div
        className={cx(
          'sticky bottom-0 z-10 flex flex-col gap-2 px-5 pb-[calc(12px+var(--safe-bottom))] pt-3',
          floating ? 'rounded-t-xl bg-paper/95' : 'bg-paper',
        )}
      >
        {actions}
      </div>
    </div>
  );
}

interface OnboardingTopBarProps {
  step: number;
  onBack: () => void;
  /** Back and progress as pills on the left, leaving the top-right corner to Luka (PersonalInfoView). */
  floating?: boolean;
}

/** Back button and "1 / 3" progress (OnboardingTopBar). */
export function OnboardingTopBar({ step, onBack, floating = false }: OnboardingTopBarProps) {
  const display = useDisplay();
  const stepLabel = (
    <>
      <span aria-hidden>{`${step} / ${ONBOARDING_STEP_COUNT}`}</span>
      <span className="sr-only">
        {display.t(`Step ${step} of ${ONBOARDING_STEP_COUNT}`, `ნაბიჯი ${step} / ${ONBOARDING_STEP_COUNT}`)}
      </span>
    </>
  );

  return (
    <div className={cx('relative z-10 flex min-h-[52px] items-center px-3', floating ? 'gap-2' : 'justify-between')}>
      <button
        type="button"
        onClick={onBack}
        aria-label={display.t('Back', 'უკან')}
        className={cx(
          'pressable-dim flex h-11 w-11 items-center justify-center rounded-full text-ink',
          floating && 'bg-paper/[0.92]',
        )}
      >
        <Icon name="chevron.left" size={20} />
      </button>
      <p
        className={cx(
          'type-footnote font-semibold text-inkSoft',
          floating && 'flex min-h-[32px] items-center rounded-full bg-paper/[0.92] px-3',
        )}
      >
        {stepLabel}
      </p>
    </div>
  );
}

interface StepHeaderProps {
  overline: string;
  title: string;
  message: string;
  className?: string;
}

/** Overline, title and a line of explanation at the top of a step. The title is the page's heading. */
export function StepHeader({ overline, title, message, className }: StepHeaderProps) {
  return (
    <header className={cx('flex flex-col gap-2', className)}>
      <Overline>{overline}</Overline>
      <h1 className="type-title text-ink">{title}</h1>
      <p className="type-callout text-inkSoft">{message}</p>
    </header>
  );
}
