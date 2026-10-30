import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Link } from '../layout/router/Link.tsx';
import type { LinkProps } from '../layout/router/Link.tsx';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';

export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'destructive';

const kindClasses: Record<ButtonKind, { enabled: string; disabled: string }> = {
  primary: { enabled: 'bg-ink text-white', disabled: 'bg-inkMuted text-white/90' },
  secondary: { enabled: 'border border-line bg-surface text-ink', disabled: 'border border-line bg-surface text-inkMuted' },
  tertiary: { enabled: 'text-ink', disabled: 'text-inkMuted' },
  destructive: { enabled: 'bg-coralPale text-coralDeep', disabled: 'bg-coralPale text-inkMuted' },
};

/** The look of an Algi button (AlgiButtonAppearance), shared by `Button` and `ButtonLink`. */
export function buttonClasses(kind: ButtonKind, isDisabled = false): string {
  const isTertiary = kind === 'tertiary';
  return cx(
    'type-headline inline-flex items-center justify-center gap-2 rounded-md text-center select-none',
    isTertiary ? 'min-h-[44px] px-2 pressable-dim' : 'min-h-[54px] w-full px-4 pressable',
    isDisabled ? kindClasses[kind].disabled : kindClasses[kind].enabled,
    isDisabled && 'cursor-not-allowed',
  );
}

/** iOS-style activity indicator: eight spokes turning in steps. */
export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="inline-flex shrink-0 animate-spinner-turn"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        {Array.from({ length: 8 }, (_, spoke) => (
          <rect
            key={spoke}
            x="11"
            y="2"
            width="2.2"
            height="6"
            rx="1.1"
            fill="currentColor"
            opacity={1 - spoke * 0.11}
            transform={`rotate(${-spoke * 45} 12 12)`}
          />
        ))}
      </svg>
    </span>
  );
}

interface ButtonContentProps {
  icon?: string;
  trailingIcon?: string;
  isLoading?: boolean;
  children: ReactNode;
}

function ButtonContent({ icon, trailingIcon, isLoading, children }: ButtonContentProps) {
  return (
    <>
      {isLoading && <Spinner size={18} />}
      {icon && !isLoading && <Icon name={icon} size={18} />}
      <span>{children}</span>
      {trailingIcon && <Icon name={trailingIcon} size={18} />}
    </>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: ButtonKind;
  /** Shows a spinner and ignores presses, without the disabled look (AlgiButtonStyle isLoading). */
  isLoading?: boolean;
  /** Leading SF Symbol. */
  icon?: string;
  /** Trailing SF Symbol, e.g. "arrow.right" on Continue. */
  trailingIcon?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { kind = 'primary', isLoading = false, icon, trailingIcon, disabled = false, className, onClick, children, type = 'button', ...rest },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isLoading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={isLoading || undefined}
      aria-disabled={isLoading || undefined}
      className={cx(buttonClasses(kind, disabled), className)}
      onClick={handleClick}
      {...rest}
    >
      <ButtonContent icon={icon} trailingIcon={trailingIcon} isLoading={isLoading}>
        {children}
      </ButtonContent>
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps {
  kind?: ButtonKind;
  icon?: string;
  trailingIcon?: string;
}

/** Navigation that looks like a button (iOS ActionLink). */
export function ButtonLink({ kind = 'primary', icon, trailingIcon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cx(buttonClasses(kind), className)} {...rest}>
      <ButtonContent icon={icon} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </Link>
  );
}
