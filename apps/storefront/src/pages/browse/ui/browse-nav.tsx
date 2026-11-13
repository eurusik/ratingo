'use client';

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

const MEDIA_TYPES: readonly MediaType[] = ['show', 'movie'];

interface BrowseNavProps {
  category: BrowseCategory;
  state: BrowseState;
}

function hrefFor(target: BrowseCategory, state: BrowseState): string {
  return browseHref(target.slug, carryStateTo(target, state));
}

export function TypeSwitch({ category, state }: BrowseNavProps) {
  const { dict } = useTranslation();

  return (
    <nav
      aria-label={dict.browse.typeLabel}
      className="grid w-48 shrink-0 grid-cols-2 gap-1 rounded-2xl bg-default p-1 md:w-56"
    >
      {MEDIA_TYPES.map((type) => {
        const isCurrent = type === category.type;
        return (
          <Link
            key={type}
            href={hrefFor(counterpartCategory(category, type), state)}
            aria-current={isCurrent ? 'page' : undefined}
            className="flex min-h-tap items-center justify-center rounded-xl text-sm font-semibold text-muted no-underline transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm md:min-h-9"
          >
            {dict.browse.type[type]}
          </Link>
        );
      })}
    </nav>
  );
}

export function PoolNav({ category, state }: BrowseNavProps) {
  const { dict } = useTranslation();

  return (
    <nav
      aria-label={dict.browse.poolsLabel}
      className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {browseCategoriesOfType(category.type).map((pool) => {
        const isCurrent = pool.slug === category.slug;
        return (
          <Link
            key={pool.slug}
            href={hrefFor(pool, state)}
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
