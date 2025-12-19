'use client';

import { type ReactNode } from 'react';
import { SavedStatusProvider } from '@/core/saved-status';

interface MediaCardsWithStatusProps {
  /** Media item IDs to prefetch status for. */
  mediaItemIds: string[];
  children: ReactNode;
}

/**
 * Client wrapper that provides SavedStatusProvider for media cards.
 * Prefetches save status for all cards in a single batch request.
 */
export function MediaCardsWithStatus({ mediaItemIds, children }: MediaCardsWithStatusProps) {
  return (
    <SavedStatusProvider mediaItemIds={mediaItemIds}>
      {children}
    </SavedStatusProvider>
  );
}
