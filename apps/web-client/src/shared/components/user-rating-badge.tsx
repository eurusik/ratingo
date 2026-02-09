import { User } from 'lucide-react';
import { cn } from '@/shared/utils';
import { findPresetByScore } from '@/modules/details/constants/rating-presets';

interface UserRatingBadgeProps {
  rating: number;
  /** Accessible label, e.g. "Ваша оцінка: 85" — provided by the consumer via i18n. */
  label?: string;
  className?: string;
}

/**
 * Compact badge showing user's personal rating with ownership signal.
 * User icon distinguishes it from system badges (trending, rank).
 */
export function UserRatingBadge({ rating, label, className }: UserRatingBadgeProps) {
  const preset = findPresetByScore(rating);

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded-full',
        'bg-black/50 border border-white/20 backdrop-blur-sm',
        'text-xs font-medium text-white',
        className,
      )}
      title={label}
      aria-label={label}
    >
      <User className="w-3 h-3 text-white/70" />
      <span>{preset?.emoji ?? '⭐'}</span>
      <span>{rating}</span>
    </div>
  );
}
