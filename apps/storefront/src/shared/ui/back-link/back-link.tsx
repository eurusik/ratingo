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
  clearSharedArt,
  hasPreviousRoute,
  nameArtLinkingTo,
  waitForRouteCommit,
} from '@/shared/lib';

interface BackLinkProps {
  fallbackHref: string;
  className?: string;
  'aria-label'?: string;
  children: ReactNode;
}

export function BackLink({
  fallbackHref,
  className,
  'aria-label': ariaLabel,
  children,
}: BackLinkProps) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    if (!hasPreviousRoute()) return;
    event.preventDefault();
    const leavingPath = window.location.pathname;
    markProgrammaticBack();
    void runNavigationTransition(
      [NAV_BACK_TRANSITION],
      () => router.back(),
      async () => {
        await waitForRouteCommit();
        nameArtLinkingTo(leavingPath);
      },
    ).finally(clearSharedArt);
  };

  return (
    <Link href={fallbackHref} className={className} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Link>
  );
}
