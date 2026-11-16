'use client';

import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  NAV_BACK_TRANSITION,
  markProgrammaticBack,
  runNavigationTransition,
} from '@ratingo/ui/motion';
import {
  hasPreviousRoute,
  isPlainClick,
  nameArtLinkingTo,
  releaseSharedArt,
  restoreRememberedScroll,
  waitForRouteCommit,
} from '@/shared/lib';

interface BackLinkProps {
  fallbackHref: string;
  className?: string;
  'aria-label'?: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}

export function BackLink({
  fallbackHref,
  className,
  'aria-label': ariaLabel,
  onNavigate,
  children,
}: BackLinkProps) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.(event);
    if (event.defaultPrevented || !isPlainClick(event) || !hasPreviousRoute()) return;
    event.preventDefault();
    const leavingPath = window.location.pathname;
    let returningArt: HTMLElement | null = null;
    markProgrammaticBack();
    void runNavigationTransition(
      [NAV_BACK_TRANSITION],
      () => router.back(),
      async () => {
        await waitForRouteCommit();
        restoreRememberedScroll();
        returningArt = nameArtLinkingTo(leavingPath);
      },
    ).finally(() => releaseSharedArt(returningArt));
  };

  return (
    <Link href={fallbackHref} className={className} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Link>
  );
}
