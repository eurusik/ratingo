'use client';

import Link from 'next/link';
import { Tabs, buttonVariants } from '@heroui/react';
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

export function TypeTabs({ category, state }: BrowseNavProps) {
  const { dict } = useTranslation();

  return (
    <Tabs selectedKey={category.type} className="w-48 shrink-0 md:w-56">
      <Tabs.ListContainer>
        <Tabs.List aria-label={dict.browse.typeLabel}>
          {MEDIA_TYPES.map((type) => (
            <Tabs.Tab
              key={type}
              id={type}
              href={hrefFor(counterpartCategory(category, type), state)}
              className="min-h-tap md:min-h-0"
            >
              {dict.browse.type[type]}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
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
