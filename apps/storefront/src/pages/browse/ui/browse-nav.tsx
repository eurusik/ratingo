'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { isPlainClick } from '@/shared/lib';
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

function openInPlace(next: BrowseLocation, onOpen: (next: BrowseLocation) => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onOpen(next);
  };
}

const EDGE_FADE_SIDE = {
  start: 'start-0 bg-linear-to-r',
  end: 'end-0 bg-linear-to-l',
} as const;

function EdgeFade({ side, isVisible }: { side: keyof typeof EDGE_FADE_SIDE; isVisible: boolean }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 w-10 from-background/90 to-transparent transition-opacity motion-reduce:transition-none ${EDGE_FADE_SIDE[side]} ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    />
  );
}

export function TypeSwitch({ category, state, onOpen }: BrowseNavProps) {
  const { dict } = useTranslation();

  return (
    <nav aria-label={dict.browse.typeLabel} className="flex items-baseline gap-5">
      {MEDIA_TYPES.map((type) => {
        const next = locationOf(counterpartCategory(category, type), state);
        return (
          <Link
            key={type}
            href={browseHref(next.slug, next.state)}
            onClick={openInPlace(next, onOpen)}
            aria-current={type === category.type ? 'page' : undefined}
            className="flex min-h-tap items-center rounded-lg text-3xl font-extrabold tracking-tight text-muted no-underline transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:text-foreground md:text-4xl"
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
    <div className="relative flex min-w-0 flex-1">
      <nav
        ref={poolsRef}
        aria-label={dict.browse.poolsLabel}
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      <EdgeFade side="start" isVisible={edges.hasMoreBefore} />
      <EdgeFade side="end" isVisible={edges.hasMoreAfter} />
    </div>
  );
}
