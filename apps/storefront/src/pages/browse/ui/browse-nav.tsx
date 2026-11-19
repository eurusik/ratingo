'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { isPlainClick } from '@/shared/lib';
import { EdgeFade, TitleSwitch, useHorizontalScroller } from '@/shared/ui';
import {
  browseCategoriesOfType,
  counterpartCategory,
  type BrowseCategory,
} from '../model/browse-category';
import { browseHref, carryStateTo, type BrowseState } from '../model/browse-state';
import type { BrowseLocation } from '../model/use-browse-navigation';

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

export function TypeSwitch({ category, state, onOpen }: BrowseNavProps) {
  const { dict } = useTranslation();
  const targets = MEDIA_TYPES.map((type) => ({
    type,
    next: locationOf(counterpartCategory(category, type), state),
  }));
  const options = targets.map(({ type, next }) => ({
    id: type,
    label: dict.browse.type[type],
    href: browseHref(next.slug, next.state),
  }));

  return (
    <TitleSwitch
      label={dict.browse.typeLabel}
      options={options}
      value={category.type}
      onSelect={(type) => {
        const target = targets.find((candidate) => candidate.type === type);
        if (target) onOpen(target.next);
      }}
    />
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
