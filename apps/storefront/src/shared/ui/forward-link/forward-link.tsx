'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NAV_FORWARD_TRANSITION, runNavigationTransition } from '@ratingo/ui/motion';
import { isPlainClick, nameArtOfLink, releaseSharedArt, waitForRouteCommit } from '@/shared/lib';

type ForwardLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

export function ForwardLink({ href, onClick, replace, scroll, ...props }: ForwardLinkProps) {
  const router = useRouter();

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!isPlainClick(event)) return;
    event.preventDefault();
    const art = nameArtOfLink(event.currentTarget);
    void runNavigationTransition(
      [NAV_FORWARD_TRANSITION],
      () => {
        releaseSharedArt(art);
        if (replace) router.replace(href, { scroll });
        else router.push(href, { scroll });
      },
      waitForRouteCommit,
    );
  };

  return <Link href={href} replace={replace} scroll={scroll} onClick={navigate} {...props} />;
}
