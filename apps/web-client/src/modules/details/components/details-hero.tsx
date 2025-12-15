/**
 * Hero section with backdrop, title, ratings, and badges.
 */

'use client';

import Image from 'next/image';
import { Star, Eye, Flame, Sparkles, TrendingUp, Clapperboard } from 'lucide-react';
import { useState } from 'react';
import type { BadgeKey, Stats, ExternalRatings, Genre, ImageSet } from '../types';
import { cn } from '@/shared/utils';
import { formatRating, formatYear } from '@/shared/utils/format';
import type { getDictionary } from '@/shared/i18n';

export interface DetailsHeroProps {
  title: string;
  originalTitle?: string | null;
  poster: ImageSet;
  backdrop?: ImageSet | null;
  releaseDate: string;
  genres: Genre[];
  stats: Stats;
  externalRatings?: ExternalRatings | null;
  badgeKey?: BadgeKey | null;
  rank?: number;
  quickPitch?: string;
  dict: ReturnType<typeof getDictionary>;
}

const badgeConfig: Record<BadgeKey, { icon: typeof Flame; className: string; labelKey: 'trending' | 'newRelease' | 'rising' | 'newEpisode' }> = {
  TRENDING: { icon: Flame, className: 'bg-red-600 text-white', labelKey: 'trending' },
  NEW_RELEASE: { icon: Sparkles, className: 'bg-green-500 text-white', labelKey: 'newRelease' },
  RISING: { icon: TrendingUp, className: 'bg-orange-500 text-white', labelKey: 'rising' },
  NEW_EPISODE: { icon: Clapperboard, className: 'bg-purple-500 text-white', labelKey: 'newEpisode' },
};

const ratingSourceConfig = {
  imdb: { label: 'IMDb', className: 'text-yellow-400 bg-yellow-400/20', isPercent: false },
  tmdb: { label: 'TMDB', className: 'text-sky-400 bg-sky-400/20', isPercent: false },
  trakt: { label: 'Trakt', className: 'text-red-400 bg-red-400/20', isPercent: false },
  metacritic: { label: 'MC', className: 'text-yellow-300 bg-yellow-300/20', isPercent: true },
  rottenTomatoes: { label: 'RT', className: 'text-red-500 bg-red-500/20', isPercent: true },
} as const;

export function DetailsHero({
  title,
  originalTitle,
  poster,
  backdrop,
  releaseDate,
  genres,
  stats,
  externalRatings,
  badgeKey,
  rank,
  quickPitch,
  dict,
}: DetailsHeroProps) {
  const rating = stats.ratingoScore / 10;
  const BadgeIcon = badgeKey ? badgeConfig[badgeKey]?.icon : null;
  const [backdropError, setBackdropError] = useState(false);

  // Collect all available external ratings
  const availableRatings = externalRatings
    ? (Object.entries(externalRatings) as [keyof typeof ratingSourceConfig, { rating: number; voteCount?: number } | undefined][])
        .filter(([, data]) => data?.rating != null)
        .map(([source, data]) => ({ source, ...data! }))
    : [];

  // Use poster as fallback if backdrop fails or doesn't exist
  const useBackdrop = backdrop && !backdropError;

  return (
    <section className="relative min-h-[70vh] md:min-h-[60vh] flex items-end">
      {/* FULL BACKDROP */}
      <div className="absolute inset-0 z-0">
        {useBackdrop ? (
          <>
            <Image
              src={backdrop.large}
              alt=""
              fill
              className="object-cover"
              priority
              onError={() => setBackdropError(true)}
            />
            {/* Gradient overlays for smooth fade into background */}
            {/* Bottom fade - strongest, creates the "dissolve" effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 via-40% to-transparent" />
            {/* Left side vignette */}
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/60 via-transparent to-zinc-950/30" />
            {/* Top subtle darkening */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-transparent" />
            {/* Radial vignette for cinematic look */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(9,9,11,0.4)_70%,rgba(9,9,11,0.8)_100%)]" />
          </>
        ) : (
          <>
            <Image
              src={poster.large}
              alt=""
              fill
              className="object-cover scale-110 blur-xl"
              priority
            />
            {/* Darker gradients for blurred poster */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-zinc-950/30 to-transparent" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative w-full pb-8 pt-32 md:pt-48">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-6 md:gap-10 items-end">
          {/* Poster - LARGE & PROMINENT */}
          <div className="flex-shrink-0 w-32 md:w-48 lg:w-56">
            <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-zinc-800 shadow-2xl ring-1 ring-white/20">
              <Image
                src={poster.large}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 128px, (max-width: 1024px) 192px, 224px"
                priority
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-4 md:space-y-5">
            {/* Title - HUGE */}
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-lg">
                {title}
              </h1>
              {originalTitle && originalTitle !== title && (
                <p className="text-base md:text-lg text-zinc-400 mt-1">{originalTitle}</p>
              )}
            </div>

            {/* Meta line */}
            <p className="text-sm md:text-base text-zinc-300">
              {formatYear(releaseDate)} • {genres.map(g => g.name).join(', ')}
            </p>

            {/* Ratings row - PROMINENT */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Primary Ratingo rating - LARGER */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-yellow-500/30">
                <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                <span className="text-2xl md:text-3xl font-bold text-white">{formatRating(rating)}</span>
              </div>

              {/* All external ratings */}
              {availableRatings.map(({ source, rating: r }) => {
                const config = ratingSourceConfig[source];
                const displayValue = config.isPercent ? `${Math.round(r)}%` : formatRating(r);
                return (
                  <div key={source} className="flex items-center gap-2 bg-zinc-900/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded', config.className)}>
                      {config.label}
                    </span>
                    <span className="text-base font-semibold text-white">{displayValue}</span>
                  </div>
                );
              })}

              {/* Live watchers */}
              {stats.liveWatchers != null && stats.liveWatchers > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium">{stats.liveWatchers.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Status badge - separate row */}
            {badgeKey && BadgeIcon && (
              <span className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold w-fit',
                badgeConfig[badgeKey].className
              )}>
                <BadgeIcon className="w-4 h-4" />
                {dict.card.badge[badgeConfig[badgeKey].labelKey]}
              </span>
            )}

            {/* Quick Pitch - READABLE */}
            {quickPitch && (
              <p className="text-base md:text-lg text-zinc-200 leading-relaxed max-w-2xl">
                {quickPitch}
              </p>
            )}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
