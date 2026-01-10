/**
 * Signals section — structured container for all social proof.
 * Groups signals by role with clear visual hierarchy.
 * Mobile-optimized: fewer badges, compact activity row.
 */

import { TrendingUp, Users } from 'lucide-react';
import type { BadgeKey, Stats, ExternalRatings } from '../types';
import type { getDictionary } from '@/shared/i18n';
import { QualityBadge } from './quality-badge';
import { PopularityBadge } from './popularity-badge';
import { StatusBadges } from './status-badges';
import { RatingBadge } from './rating-badge';

interface SignalsSectionProps {
  stats?: Stats | null;
  badgeKey?: BadgeKey | null;
  rank?: number;
  genres?: string[];
  externalRatings?: ExternalRatings | null;
  dict: ReturnType<typeof getDictionary>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] md:text-xs text-zinc-500 uppercase tracking-wider">
      {children}
    </span>
  );
}

export function SignalsSection({
  stats,
  badgeKey,
  rank,
  genres,
  externalRatings,
  dict,
}: SignalsSectionProps) {
  // Badge helpers
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

  const hasLiveWatchers = stats?.liveWatchers != null && stats.liveWatchers > 0;
  const hasTotalWatchers = stats?.totalWatchers != null && stats.totalWatchers > 0;
  const hasActivity = hasLiveWatchers || hasTotalWatchers;

  const hasGenres = genres && genres.length > 0;

  const hasExternalRatings =
    externalRatings?.imdb?.rating ||
    externalRatings?.tmdb?.rating ||
    externalRatings?.trakt?.rating;

  if (!hasBadges && !hasActivity && !hasGenres && !hasExternalRatings) {
    return null;
  }

  return (
    <section className="space-y-5 md:space-y-8">
      {/* Як сприймають — max 2 badges on mobile, 3 on desktop */}
      {hasBadges && (
        <div className="space-y-2">
          <SectionLabel>{dict.details.signals.perception}</SectionLabel>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadges badgeKey={badgeKey} rank={rank} dict={{ badge: dict.card.badge }} />
            {hasQualityBadge && (
              <QualityBadge
                score={stats!.qualityScore!}
                {...getQualityBadgeProps(stats!.qualityScore!)}
              />
            )}
            {/* PopularityBadge — hidden on mobile to reduce visual noise */}
            {hasPopularityBadge && (
              <span className="hidden md:inline-flex">
                <PopularityBadge
                  score={stats!.popularityScore!}
                  {...getPopularityBadgeProps(stats!.popularityScore!)}
                />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Активність — compact inline on mobile, with label on desktop */}
      {hasActivity && (
        <div className="flex items-center gap-3 text-xs md:text-sm text-zinc-500">
          {hasLiveWatchers && (
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="text-zinc-400">{stats!.liveWatchers!.toLocaleString()}</span>
              <span className="hidden md:inline">{dict.details.watchingNow}</span>
              <span className="md:hidden">зараз</span>
            </span>
          )}
          {hasLiveWatchers && hasTotalWatchers && <span className="text-zinc-600">·</span>}
          {hasTotalWatchers && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="text-zinc-400">{stats!.totalWatchers!.toLocaleString()}</span>
              <span className="hidden md:inline">{dict.details.totalWatchers}</span>
              <span className="md:hidden">всього</span>
            </span>
          )}
        </div>
      )}

      {/* Підійде якщо */}
      {hasGenres && (
        <div className="space-y-2">
          <SectionLabel>{dict.details.quickPitch.suitable}</SectionLabel>
          <div className="flex items-center gap-2 flex-wrap">
            {genres.map((genre) => (
              <span
                key={genre}
                className="px-2 md:px-2.5 py-0.5 md:py-1 text-[11px] md:text-xs font-medium text-zinc-300 bg-zinc-800/60 rounded-full border border-zinc-700/50"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Зовнішні рейтинги */}
      {hasExternalRatings && (
        <div className="space-y-2">
          <SectionLabel>{dict.details.signals.externalRatings}</SectionLabel>
          <div className="flex items-center gap-2 flex-wrap">
            {externalRatings?.imdb?.rating != null && (
              <RatingBadge source="IMDb" rating={externalRatings.imdb.rating} />
            )}
            {externalRatings?.tmdb?.rating != null && (
              <RatingBadge source="TMDB" rating={externalRatings.tmdb.rating} />
            )}
            {externalRatings?.trakt?.rating != null && (
              <RatingBadge source="Trakt" rating={externalRatings.trakt.rating} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
