'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import {
  browseCategoriesOfType,
  counterpartCategory,
  type BrowseCategory,
} from '../model/browse-category';
import { browseHref, carryStateTo, type BrowseState } from '../model/browse-state';
import type { BrowseLocation } from '../model/use-browse-navigation';
import { useHorizontalScroller } from '../lib/horizontal-scroller';

const MEDIA_TYPES: readonly MediaType[] = ['show', 'movie'];

interface BrowseNavProps {
  category: BrowseCategory;
  state: BrowseState;
  onOpen: (next: BrowseLocation) => void;
}

function locationOf(target: BrowseCategory, state: BrowseState): BrowseLocation {
  return { slug: target.slug, state: carryStateTo(target, state) };
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function openInPlace(next: BrowseLocation, onOpen: (next: BrowseLocation) => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onOpen(next);
  };
}

export function TypeSwitch({ category, state, onOpen }: BrowseNavProps) {
  const { dict } = useTranslation();

  return (
    <nav
      aria-label={dict.browse.typeLabel}
      className="grid w-48 shrink-0 grid-cols-2 gap-1 rounded-2xl bg-default p-1 md:w-56"
    >
      {MEDIA_TYPES.map((type) => {
        const next = locationOf(counterpartCategory(category, type), state);
        return (
          <Link
            key={type}
            href={browseHref(next.slug, next.state)}
            onClick={openInPlace(next, onOpen)}
            aria-current={type === category.type ? 'page' : undefined}
            className="flex min-h-tap items-center justify-center rounded-xl text-sm font-semibold text-muted no-underline transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm md:min-h-9"
          >
            {dict.browse.type[type]}
          </Link>
        );
      })}
    </nav>
  );
}

export function PoolNav({ category, state, onOpen }: BrowseNavProps) {
  const { dict } = useTranslation();
  const { ref: poolsRef, edges } = useHorizontalScroller<HTMLElement>({
    activeKey: category.slug,
    contentKey: category.type,
  });

  return (
    <nav
      ref={poolsRef}
      aria-label={dict.browse.poolsLabel}
      data-more-before={edges.hasMoreBefore || undefined}
      data-more-after={edges.hasMoreAfter || undefined}
      className="relative flex min-w-0 flex-1 gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_var(--fade-before),black_calc(100%-var(--fade-after)),transparent)] scroll-px-10 [scrollbar-width:none] [--fade-after:0px] [--fade-before:0px] data-[more-after]:[--fade-after:2.5rem] data-[more-before]:[--fade-before:2.5rem] [&::-webkit-scrollbar]:hidden"
    >
      {browseCategoriesOfType(category.type).map((pool) => {
        const isCurrent = pool.slug === category.slug;
        const next = locationOf(pool, state);
        return (
          <Link
            key={pool.slug}
            href={browseHref(next.slug, next.state)}
            onClick={openInPlace(next, onOpen)}
            aria-current={isCurrent ? 'page' : undefined}
            className={buttonVariants({
              variant: isCurrent ? 'primary' : 'outline',
              size: 'sm',
              className: 'min-h-10 shrink-0 rounded-full px-4 whitespace-nowrap no-underline',
            })}
          >
            {dict.browse.pools[pool.pool].label}
          </Link>
        );
      })}
    </nav>
  );
}
