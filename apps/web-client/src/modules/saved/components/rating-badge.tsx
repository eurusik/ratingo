import { findPresetByScore } from '@/modules/details/constants/rating-presets';

interface RatingBadgeProps {
  rating: number;
  className?: string;
}

/**
 * Compact emoji + score badge for displaying user ratings.
 * Used in media cards and favorite update cards.
 */
export function RatingBadge({ rating, className = '' }: RatingBadgeProps) {
  const preset = findPresetByScore(rating);

  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs font-medium text-white ${className}`}
      aria-label={`Rating: ${rating}`}
    >
      <span>{preset?.emoji ?? '⭐'}</span>
      <span>{rating}</span>
    </div>
  );
}
