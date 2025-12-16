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
  const imdbRating = externalRatings?.imdb?.rating;
  const BadgeIcon = badgeKey ? badgeConfig[badgeKey]?.icon : null;
  const [backdropError, setBackdropError] = useState(false);

  // Use poster as fallback if backdrop fails or doesn't exist
  const useBackdrop = backdrop && !backdropError;

  return (
    <section className="relative min-h-[70vh] md:min-h-[60vh] flex items-end">
      {/* FULL BACKDROP */}
      <div className="absolute inset-0 -z-10">
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
            {/* Much lighter gradients to show backdrop */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/40 via-transparent to-transparent" />
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

            {/* Ratings and stats - VERTICAL LAYOUT */}
            <div className="space-y-3">
              {/* Ratings row */}
              <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                {/* Primary rating */}
                <div className="flex items-center gap-2 bg-zinc-900/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  <span className="text-xl md:text-2xl font-bold text-white">{formatRating(rating)}</span>
                </div>

                {/* IMDb rating */}
                {imdbRating != null && imdbRating !== rating && (
                  <div className="flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/20 px-1 py-0.5 rounded">IMDb</span>
                    <span className="text-sm font-semibold text-zinc-300">{formatRating(imdbRating)}</span>
                  </div>
                )}

                {/* TMDB rating */}
                {externalRatings?.tmdb?.rating != null && externalRatings.tmdb.rating !== rating && (
                  <div className="flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-400/20 px-1 py-0.5 rounded">TMDB</span>
                    <span className="text-sm font-semibold text-zinc-300">{formatRating(externalRatings.tmdb.rating)}</span>
                  </div>
                )}

                {/* Trakt rating */}
                {externalRatings?.trakt?.rating != null && externalRatings.trakt.rating !== rating && (
                  <div className="flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <span className="text-[10px] font-bold text-red-400 bg-red-400/20 px-1 py-0.5 rounded">Trakt</span>
                    <span className="text-sm font-semibold text-zinc-300">{formatRating(externalRatings.trakt.rating)}</span>
                  </div>
                )}

                {/* Rotten Tomatoes rating */}
                {externalRatings?.rottenTomatoes?.rating != null && (
                  <div className="flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <span className="text-[10px] font-bold text-green-400 bg-green-400/20 px-1 py-0.5 rounded">RT</span>
                    <span className="text-sm font-semibold text-zinc-300">{externalRatings.rottenTomatoes.rating}%</span>
                  </div>
                )}
              </div>

              {/* Live watchers */}
              {stats.liveWatchers != null && stats.liveWatchers > 0 && (
                <div className="flex items-center gap-2 text-zinc-300">
                  <Eye className="w-5 h-5 text-blue-400" />
                  <span className="text-base font-medium">{stats.liveWatchers.toLocaleString()}</span>
                </div>
              )}

              {/* Status badges */}
              {(badgeKey || (rank != null && rank <= 10)) && (
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status badge */}
                  {badgeKey && BadgeIcon && (
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold',
                      badgeConfig[badgeKey].className
                    )}>
                      <BadgeIcon className="w-4 h-4" />
                      {dict.card.badge[badgeConfig[badgeKey].labelKey]}
                    </span>
                  )}

                  {/* Rank badge */}
                  {rank != null && rank <= 10 && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-yellow-400 text-black">
                      №{rank}
                    </span>
                  )}
                </div>
              )}
            </div>

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
