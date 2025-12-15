/**
 * Hero section with backdrop, title, ratings, and badges.
 *
 * Mobile-first: compact poster + info stack.
 * SERVER COMPONENT - receives dict as prop for SSR/SSG.
 */

import Image from 'next/image';
import { Star, Eye, Flame, Sparkles, TrendingUp, Clapperboard } from 'lucide-react';
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

  return (
    <section className="relative">
      {/* Backdrop (optional, for future) */}
      {backdrop && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={backdrop.large}
            alt=""
            fill
            className="object-cover opacity-10 blur-sm"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-zinc-950/80 to-zinc-950" />
        </div>
      )}

      {/* Content */}
      <div className="flex gap-4 md:gap-6">
        {/* Poster */}
        <div className="flex-shrink-0 w-28 md:w-40">
          <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-zinc-800 shadow-2xl ring-1 ring-white/10">
            <Image
              src={poster.large}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 112px, 160px"
              priority
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-1">
          {/* Title */}
          <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">
            {title}
          </h1>
          {originalTitle && originalTitle !== title && (
            <p className="text-sm text-zinc-500 mt-0.5">{originalTitle}</p>
          )}

          {/* Meta line */}
          <p className="text-sm text-zinc-400 mt-2">
            {formatYear(releaseDate)} • {genres.map(g => g.name).join(', ')}
          </p>

          {/* Ratings row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {/* Primary rating */}
            <div className="flex items-center gap-1.5">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="text-lg font-bold text-white">{formatRating(rating)}</span>
            </div>

            {/* IMDb rating */}
            {imdbRating != null && imdbRating !== rating && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-yellow-300/80">IMDb</span>
                <span className="text-white">{formatRating(imdbRating)}</span>
              </div>
            )}

            {/* Live watchers */}
            {stats.liveWatchers != null && stats.liveWatchers > 0 && (
              <div className="flex items-center gap-1 text-sm text-zinc-400">
                <Eye className="w-4 h-4 text-blue-400" />
                <span>{stats.liveWatchers.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Rank badge */}
            {rank != null && rank <= 10 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-yellow-400 text-black">
                №{rank}
              </span>
            )}

            {/* Status badge */}
            {badgeKey && BadgeIcon && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
                badgeConfig[badgeKey].className
              )}>
                <BadgeIcon className="w-3 h-3" />
                {dict.card.badge[badgeConfig[badgeKey].labelKey]}
              </span>
            )}
          </div>

          {/* Quick Pitch - THE DNA OF RATINGO */}
          {quickPitch && (
            <div className="mt-5 pt-4 border-t border-zinc-800/50">
              <p className="text-zinc-200 leading-relaxed text-[15px] font-medium">
                {quickPitch}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
