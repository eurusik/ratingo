import { cn } from '@/shared/utils';
import { findPresetByScore } from '@/modules/details/constants/rating-presets';

interface UserRatingBadgeProps {
  rating: number;
  className?: string;
}

/**
 * Compact emoji + score badge for displaying user ratings.
 * Used in media cards and favorite update cards.
 */
export function UserRatingBadge({ rating, className }: UserRatingBadgeProps) {
  const preset = findPresetByScore(rating);

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs font-medium text-white',
        className,
      )}
      aria-label={`${rating}/100`}
    >
      <span>{preset?.emoji ?? '⭐'}</span>
      <span>{rating}</span>
    </div>
  );
}
