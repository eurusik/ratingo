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
 * Minimalist rating row
 */
export function CardRating({ rating, watchers, className }: CardRatingProps) {
  return (
    <div className={cn('flex items-center gap-3 text-xs', className)}>
      {/* ⚡ Актуальність (Ratingo score) */}
      {rating != null && (
        <div className="flex items-center gap-1">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-white font-semibold">{formatRating(rating)}</span>
        </div>
      )}

      {/* 📈 Активний інтерес (Trakt watching) */}
      {watchers != null && watchers > 0 && (
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-gray-300 font-medium">{formatNumber(watchers)}</span>
        </div>
      )}
    </div>
  );
}
