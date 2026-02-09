'use client';

import { useUserRatingContext } from '@/core/user-rating';
import { RatingBadge } from '@/modules/saved/components/rating-badge';

interface CardUserRatingProps {
  mediaItemId: string;
}

/**
 * Shows user's emoji rating badge on media cards.
 * Gracefully returns null when no rating or no provider context.
 */
export function CardUserRating({ mediaItemId }: CardUserRatingProps) {
  const context = useUserRatingContext();
  if (!context) return null;

  const rating = context.getRating(mediaItemId);
  if (rating == null) return null;

  return <RatingBadge rating={rating} className="absolute bottom-2 left-2 z-10" />;
}
