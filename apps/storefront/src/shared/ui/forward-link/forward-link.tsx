'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NAV_FORWARD_TRANSITION, runNavigationTransition } from '@ratingo/ui/motion';
import { clearSharedArt, nameArtOfLink, waitForRouteCommit } from '@/shared/lib';

type ForwardLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

export function ForwardLink({ href, onClick, ...props }: ForwardLinkProps) {
  const router = useRouter();

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isPlainClick(event)) return;
    event.preventDefault();
    nameArtOfLink(event.currentTarget);
    void runNavigationTransition(
      [NAV_FORWARD_TRANSITION],
      () => {
        clearSharedArt();
        router.push(href);
      },
      waitForRouteCommit,
    );
  };

  return <Link href={href} onClick={navigate} {...props} />;
}
