'use client';

import { type ReactNode } from 'react';
import { SavedStatusProvider } from '@/core/saved-status';
import { UserRatingProvider } from '@/core/user-rating';

interface MediaCardsWithStatusProps {
  /** Media item IDs to prefetch status for. */
  mediaItemIds: string[];
  children: ReactNode;
}

/**
 * Client wrapper that provides SavedStatusProvider and UserRatingProvider for media cards.
 * Prefetches save status and user ratings for all cards in a single batch request each.
 */
export function MediaCardsWithStatus({ mediaItemIds, children }: MediaCardsWithStatusProps) {
  return (
    <SavedStatusProvider mediaItemIds={mediaItemIds}>
      <UserRatingProvider mediaItemIds={mediaItemIds}>
        {children}
      </UserRatingProvider>
    </SavedStatusProvider>
  );
}
