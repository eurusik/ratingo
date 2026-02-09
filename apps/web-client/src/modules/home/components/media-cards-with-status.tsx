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
 * Wraps children with SavedStatusProvider and UserRatingProvider to prefetch saved status and user ratings for the given media items.
 *
 * @param mediaItemIds - Array of media item IDs to prefetch save status and user ratings for.
 * @param children - React nodes to render inside the providers.
 * @returns The provided children wrapped by SavedStatusProvider and UserRatingProvider.
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