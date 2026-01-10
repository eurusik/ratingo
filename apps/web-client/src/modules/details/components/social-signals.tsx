/**
 * Social signals section — compact horizontal row.
 * Groups: StatusBadges + QualityBadge + PopularityBadge
 * Watchers stats shown separately below as "quiet row".
 */

import type { BadgeKey, Stats } from '../types';
import type { getDictionary } from '@/shared/i18n';
import { QualityBadge } from './quality-badge';
import { PopularityBadge } from './popularity-badge';
import { StatusBadges } from './status-badges';

interface SocialSignalsProps {
  stats?: Stats | null;
  badgeKey?: BadgeKey | null;
  rank?: number;
  dict: ReturnType<typeof getDictionary>;
}

export function SocialSignals({ stats, badgeKey, rank, dict }: SocialSignalsProps) {
  const getQualityBadgeProps = (score: number) => {
    if (score >= 85)
      return {
        label: dict.details.qualityBadge.high,
        tooltip: dict.details.qualityBadgeTooltip.high,
      };
    if (score >= 75)
      return {
        label: dict.details.qualityBadge.good,
        tooltip: dict.details.qualityBadgeTooltip.good,
      };
    return {
      label: dict.details.qualityBadge.decent,
      tooltip: dict.details.qualityBadgeTooltip.decent,
    };
  };

  const getPopularityBadgeProps = (score: number) => {
    if (score >= 80)
      return {
        label: dict.details.popularityBadge.hot,
        tooltip: dict.details.popularityBadgeTooltip.hot,
      };
    if (score >= 60)
      return {
        label: dict.details.popularityBadge.trending,
        tooltip: dict.details.popularityBadgeTooltip.trending,
      };
    return {
      label: dict.details.popularityBadge.rising,
      tooltip: dict.details.popularityBadgeTooltip.rising,
    };
  };

  const hasQualityBadge = stats?.qualityScore != null && stats.qualityScore >= 65;
  const hasPopularityBadge = stats?.popularityScore != null && stats.popularityScore >= 40;
  const hasStatusBadge = badgeKey || (rank != null && rank <= 10);

  const hasBadges = hasQualityBadge || hasPopularityBadge || hasStatusBadge;

  if (!hasBadges) return null;

  return (
    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
      {/* Status badges (Trending, New Release, etc.) */}
      <StatusBadges badgeKey={badgeKey} rank={rank} dict={{ badge: dict.card.badge }} />

      {/* Quality badge */}
      {hasQualityBadge && (
        <QualityBadge
          score={stats!.qualityScore!}
          {...getQualityBadgeProps(stats!.qualityScore!)}
        />
      )}

      {/* Popularity badge */}
      {hasPopularityBadge && (
        <PopularityBadge
          score={stats!.popularityScore!}
          {...getPopularityBadgeProps(stats!.popularityScore!)}
        />
      )}
    </div>
  );
}
