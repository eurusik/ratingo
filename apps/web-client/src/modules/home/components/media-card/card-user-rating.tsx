'use client';

import { useUserRatingContext } from '@/core/user-rating';
import { useTranslation } from '@/shared/i18n';
import { UserRatingBadge } from '@/shared/components/user-rating-badge';

interface CardUserRatingProps {
  mediaItemId: string;
}

/**
 * Render the user's emoji rating badge for a media card when a rating exists.
 *
 * @param mediaItemId - The media item id used to look up the user's rating
 * @returns The `UserRatingBadge` element for the media item if a rating exists, `null` otherwise
 */
export function CardUserRating({ mediaItemId }: CardUserRatingProps) {
  const { dict } = useTranslation();
  const context = useUserRatingContext();
  if (!context) return null;

  const rating = context.getRating(mediaItemId);
  if (rating == null) return null;

  const label = (dict.card?.yourRating ?? 'Ваша оцінка: {rating}').replace('{rating}', String(rating));

  return <UserRatingBadge rating={rating} label={label} className="absolute bottom-2 left-2 z-10" />;
}