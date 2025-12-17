/**
 * Smart badge component for media cards.
 *
 */

import { Flame, Sparkles, TrendingUp, Clapperboard, Play, Bookmark, Star, Tv } from 'lucide-react';
import type { BadgeKey } from '@/modules/home/types';
import { cn } from '@/shared/utils';

interface CardBadgeProps {
  /** Badge type from backend. */
  badgeKey: BadgeKey;
  /** Badge label text (for SSR compatibility). */
  label: string;
  /** Position on card. */
  position?: 'top-left' | 'top-right';
  className?: string;
}

/** Badge label keys mapping for i18n */
export const badgeLabelKeys: Record<BadgeKey, 'hit' | 'trending' | 'newRelease' | 'rising' | 'newEpisode' | 'continue' | 'inWatchlist' | 'inTheaters' | 'newOnStreaming'> = {
  HIT: 'hit',
  TRENDING: 'trending',
  NEW_RELEASE: 'newRelease',
  RISING: 'rising',
  NEW_EPISODE: 'newEpisode',
  CONTINUE: 'continue',
  IN_WATCHLIST: 'inWatchlist',
  IN_THEATERS: 'inTheaters',
  NEW_ON_STREAMING: 'newOnStreaming',
};

const badgeConfig: Record<BadgeKey, { icon: React.ElementType; className: string }> = {
  HIT: {
    icon: Star,
    className: 'bg-yellow-500 text-black',
  },
  TRENDING: {
    icon: Flame,
    className: 'bg-red-600 text-white',
  },
  NEW_RELEASE: {
    icon: Sparkles,
    className: 'bg-green-500 text-white',
  },
  RISING: {
    icon: TrendingUp,
    className: 'bg-orange-500 text-white',
  },
  NEW_EPISODE: {
    icon: Clapperboard,
    className: 'bg-purple-500 text-white',
  },
  CONTINUE: {
    icon: Play,
    className: 'bg-blue-500 text-white',
  },
  IN_WATCHLIST: {
    icon: Bookmark,
    className: 'bg-green-600 text-white',
  },
  IN_THEATERS: {
    icon: Clapperboard,
    className: 'bg-red-500 text-white',
  },
  NEW_ON_STREAMING: {
    icon: Tv,
    className: 'bg-blue-500 text-white',
  },
};

const positionClasses = {
  'top-left': 'absolute top-2 left-2',
  'top-right': 'absolute top-2 right-2',
};

/**
 * Badge overlay for media cards.
 */
export function CardBadge({ badgeKey, label, position = 'top-right', className }: CardBadgeProps) {
  const config = badgeConfig[badgeKey];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold',
        config.className,
        positionClasses[position],
        className
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}

interface RankBadgeProps {
  /** Rank number (1-3). */
  rank: number;
  className?: string;
}

/**
 * Rank badge for top-3 items.
 */
export function RankBadge({ rank, className }: RankBadgeProps) {
  if (rank > 3) return null;

  return (
    <div
      className={cn(
        'absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold',
        'bg-yellow-400 text-black',
        className
      )}
    >
      №{rank}
    </div>
  );
}
