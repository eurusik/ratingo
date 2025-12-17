/**
 * Card rating display component.
 * Note: Trakt data = interest, not live viewing.
 */

import { Activity, TrendingUp } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatNumber, formatRating } from '@/shared/utils/format';

interface CardRatingProps {
  /** Primary Ratingo score (qualityScore) - актуальність. */
  rating?: number | null;
  /** Active interest count (Trakt watching) - соціальний сигнал. */
  watchers?: number | null;
  className?: string;
}

/**
 * Rating row with spread layout: rating left, watchers right
 */
export function CardRating({ rating, watchers, className }: CardRatingProps) {
  const hasRating = rating != null;
  const hasWatchers = watchers != null && watchers > 0;

  if (!hasRating && !hasWatchers) return null;

  return (
    <div className={cn('flex items-center justify-between text-sm', className)}>
      {/* ⚡ Актуальність (left) */}
      {hasRating ? (
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-white font-semibold">{formatRating(rating)}</span>
        </div>
      ) : <div />}

      {/* � Активний інтерес (right) */}
      {hasWatchers ? (
        <div className="flex items-center gap-1.5 text-gray-400">
          <TrendingUp className="w-4 h-4" />
          <span className="font-medium">{formatNumber(watchers)}</span>
        </div>
      ) : null}
    </div>
  );
}
