/**
 * Status badges display.
 * Shows badge status (TRENDING, NEW_RELEASE, etc.) and rank badge.
 */

import { Flame, Sparkles, TrendingUp, Clapperboard, Play, Bookmark } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { BadgeKey } from '../types';

interface StatusBadgesProps {
  badgeKey?: BadgeKey | null;
  rank?: number;
  dict: {
    badge: {
      trending: string;
      newRelease: string;
      rising: string;
      newEpisode: string;
    };
  };
}

const badgeConfig: Record<BadgeKey, { icon: typeof Flame; className: string; labelKey: 'trending' | 'newRelease' | 'rising' | 'newEpisode' }> = {
  HIT: { icon: Flame, className: 'bg-red-600 text-white', labelKey: 'trending' },
  TRENDING: { icon: Flame, className: 'bg-red-600 text-white', labelKey: 'trending' },
  NEW_RELEASE: { icon: Sparkles, className: 'bg-green-500 text-white', labelKey: 'newRelease' },
  RISING: { icon: TrendingUp, className: 'bg-orange-500 text-white', labelKey: 'rising' },
  NEW_EPISODE: { icon: Clapperboard, className: 'bg-purple-500 text-white', labelKey: 'newEpisode' },
  CONTINUE: { icon: Play, className: 'bg-blue-500 text-white', labelKey: 'newEpisode' },
  IN_WATCHLIST: { icon: Bookmark, className: 'bg-green-600 text-white', labelKey: 'trending' },
};

export function StatusBadges({ badgeKey, rank, dict }: StatusBadgesProps) {
  const BadgeIcon = badgeKey ? badgeConfig[badgeKey]?.icon : null;
  const showRank = rank != null && rank <= 10;

  if (!badgeKey && !showRank) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Status badge */}
      {badgeKey && BadgeIcon && (
        <span className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold',
          badgeConfig[badgeKey].className
        )}>
          <BadgeIcon className="w-4 h-4" />
          {dict.badge[badgeConfig[badgeKey].labelKey]}
        </span>
      )}

      {/* Rank badge */}
      {showRank && (
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-yellow-400 text-black">
          №{rank}
        </span>
      )}
    </div>
  );
}
