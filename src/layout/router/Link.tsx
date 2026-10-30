import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { matchPath } from './matchPath.ts';
import { useRouter } from './Router.tsx';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** An app path such as '/plan/what-if', or an absolute URL (opens normally). */
  to: string;
  replace?: boolean;
}

function isExternal(to: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(to) || to.startsWith('//');
}

/** A click the browser should handle itself: another button, a modifier (new tab/window), or a non-self target. */
export function opensElsewhere(event: MouseEvent<HTMLAnchorElement>, target?: string): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (target !== undefined && target !== '_self')
  );
}

/** A real anchor (so middle-click, copy link, and screen readers work) that navigates in-app on a plain click. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, replace, onClick, target, ...rest }, ref) {
  const { navigate } = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || opensElsewhere(event, target) || isExternal(to)) return;
    event.preventDefault();
    navigate(to, { replace });
  };

  return <a ref={ref} href={to} target={target} onClick={handleClick} {...rest} />;
});

/** Whether `path` is the current page (`exact`) or one of its ancestors, for `aria-current` and active styles. */
export function useIsActive(path: string, exact = false): boolean {
  const { pathname } = useRouter().location;
  if (matchPath(path, pathname)) return true;
  if (exact || path === '/') return false;
  return pathname.startsWith(path.endsWith('/') ? path : `${path}/`);
}
