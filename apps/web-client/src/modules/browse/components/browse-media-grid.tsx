'use client';

import { useMemo } from 'react';
import { SavedStatusProvider } from '@/core/saved-status';
import { UserRatingProvider } from '@/core/user-rating';
import { MediaCardServer, type MediaCardServerProps } from '@/modules/home';
import type { Locale } from '@/shared/i18n';

interface BrowseMediaGridProps {
  items: MediaCardServerProps[];
  locale?: Locale;
  className?: string;
}

/**
 * Client wrapper for browse pages that provides SavedStatusProvider and UserRatingProvider.
 * Batch fetches save status and user ratings for all cards in a single request each.
 */
export function BrowseMediaGrid({ items, locale = 'uk', className = '' }: BrowseMediaGridProps) {
  const mediaItemIds = useMemo(() => items.map((item) => item.id), [items]);

  if (!items.length) {
    return null;
  }

  return (
    <SavedStatusProvider mediaItemIds={mediaItemIds}>
      <UserRatingProvider mediaItemIds={mediaItemIds}>
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${className}`}
        >
          {items.map((item) => (
            <MediaCardServer key={item.id} {...item} locale={locale} />
          ))}
        </div>
      </UserRatingProvider>
    </SavedStatusProvider>
  );
}
