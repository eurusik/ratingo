'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isPlainClick, nameArtOfLink, navigateForward, releaseSharedArt } from '@/shared/lib';

function opensElsewhere(link: HTMLAnchorElement): boolean {
  const target = link.target;
  return (target !== '' && target !== '_self') || link.hasAttribute('download');
}

type ForwardLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

export function ForwardLink({ href, onClick, replace, scroll, ...props }: ForwardLinkProps) {
  const router = useRouter();

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!isPlainClick(event) || opensElsewhere(event.currentTarget)) return;
    event.preventDefault();
    const art = nameArtOfLink(event.currentTarget);
    void navigateForward(() => {
      releaseSharedArt(art);
      if (replace) router.replace(href, { scroll });
      else router.push(href, { scroll });
    });
  };

  return <Link href={href} replace={replace} scroll={scroll} onClick={navigate} {...props} />;
}
