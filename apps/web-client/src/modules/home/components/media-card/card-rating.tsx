/**
 * Card rating display component.
 *
 * Shows primary rating, IMDb rating, and watchers count.
 * Follows tiered display strategy from memory.
 */

import { Star, Eye } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatNumber, formatRating } from '@/shared/utils/format';

interface CardRatingProps {
  /** Primary rating (TMDB → Trakt → IMDb fallback). */
  rating?: number | null;
  /** IMDb rating if available. */
  ratingImdb?: number | null;
  /** Current watchers count. */
  watchers?: number | null;
  className?: string;
}

/**
 * Compact rating row for media cards.
 *
 * Priority: TMDB → Trakt → IMDb
 * Shows IMDb separately if different from primary.
 *
 * @example
 * <CardRating rating={8.2} ratingImdb={7.1} watchers={1200} />
 * // ⭐ 8.2  IMDb 7.1  👁 1.2K
 */
export function CardRating({ rating, ratingImdb, watchers, className }: CardRatingProps) {
  return (
    <div className={cn('flex items-center justify-between text-xs', className)}>
      {/* Left: Ratings */}
      <div className="flex items-center space-x-2">
        {/* Primary rating */}
        <div className="flex items-center space-x-1">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-semibold">{formatRating(rating)}</span>
        </div>

        {/* IMDb rating (if different from primary) */}
        {ratingImdb != null && ratingImdb !== rating && (
          <div className="flex items-center space-x-1">
            <span className="text-yellow-300 font-medium">IMDb</span>
            <span className="text-white font-semibold">{formatRating(ratingImdb)}</span>
          </div>
        )}
      </div>

      {/* Right: Watchers */}
      {watchers != null && watchers > 0 && (
        <div className="flex items-center space-x-1 text-gray-300">
          <Eye className="w-3 h-3 text-blue-400" />
          <span>{formatNumber(watchers)}</span>
        </div>
      )}
    </div>
  );
}
