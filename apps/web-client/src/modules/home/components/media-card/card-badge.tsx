/**
 * Smart badge component for media cards.
 *
 * Shows badge based on CardMetaDto.badgeKey:
 * - TRENDING: 🔥 ХІТ
 * - NEW_RELEASE: 🆕 Новинка
 * - RISING: 📈 Ріст
 * - NEW_EPISODE: 🎬 Новий епізод
 */

import { Flame, Sparkles, TrendingUp, Clapperboard } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';

type BadgeKey = 'NEW_EPISODE' | 'CONTINUE' | 'IN_WATCHLIST' | 'NEW_RELEASE' | 'RISING' | 'TRENDING';

interface CardBadgeProps {
  /** Badge type from backend. */
  badgeKey: BadgeKey;
  /** Position on card. */
  position?: 'top-left' | 'top-right';
  className?: string;
}

const badgeConfig: Record<BadgeKey, { labelKey: string; icon: React.ElementType; className: string }> = {
  TRENDING: {
    labelKey: 'card.badge.trending',
    icon: Flame,
    className: 'bg-red-600 text-white',
  },
  NEW_RELEASE: {
    labelKey: 'card.badge.newRelease',
    icon: Sparkles,
    className: 'bg-green-500 text-white',
  },
  RISING: {
    labelKey: 'card.badge.rising',
    icon: TrendingUp,
    className: 'bg-orange-500 text-white',
  },
  NEW_EPISODE: {
    labelKey: 'card.badge.newEpisode',
    icon: Clapperboard,
    className: 'bg-purple-500 text-white',
  },
  CONTINUE: {
    labelKey: '',
    icon: () => null,
    className: '',
  },
  IN_WATCHLIST: {
    labelKey: '',
    icon: () => null,
    className: '',
  },
};

const positionClasses = {
  'top-left': 'absolute top-2 left-2',
  'top-right': 'absolute top-2 right-2',
};

/**
 * Badge overlay for media cards.
 *
 * @example
 * <CardBadge badgeKey="TRENDING" position="top-right" />
 * // 🔥 ХІТ
 */
export function CardBadge({ badgeKey, position = 'top-right', className }: CardBadgeProps) {
  const { t } = useTranslation();
  const config = badgeConfig[badgeKey];

  // Skip empty badges
  if (!config.labelKey) return null;

  const Icon = config.icon;
  const label = t(config.labelKey);

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
 *
 * @example
 * <RankBadge rank={1} />
 * // №1 (gold)
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
