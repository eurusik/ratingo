/**
 * Hero section with backdrop, title, ratings, and badges.
 */

'use client';

import Image from 'next/image';
import { Activity, Info } from 'lucide-react';
import type { BadgeKey, Stats, ExternalRatings, Genre, ImageSet } from '../types';
import { formatRating, formatYear } from '@/shared/utils/format';
import type { getDictionary } from '@/shared/i18n';
import { RatingBadge } from './rating-badge';
import { QualityBadge } from './quality-badge';
import { PopularityBadge } from './popularity-badge';
import { QuickPitchScroll } from './quick-pitch-scroll';
import { WatchersStats } from './watchers-stats';
import { StatusBadges } from './status-badges';
import { HeroBackdrop } from './hero-backdrop';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

export interface DetailsHeroProps {
  title: string;
  originalTitle?: string | null;
  poster?: ImageSet | null;
  backdrop?: ImageSet | null;
  releaseDate: string;
  genres?: Genre[] | null;
  stats?: Stats | null;
  externalRatings?: ExternalRatings | null;
  badgeKey?: BadgeKey | null;
  rank?: number;
  quickPitch?: string;
  dict: ReturnType<typeof getDictionary>;
}



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
  const rating = stats?.qualityScore;
  const imdbRating = externalRatings?.imdb?.rating;
  const isClassicCase = rating != null && rating >= 80 && stats?.liveWatchers != null && stats.liveWatchers < 100;

  // Compute badge labels and tooltips
  const getQualityBadgeProps = (score: number) => {
    if (score >= 85) return { label: dict.details.qualityBadge.high, tooltip: dict.details.qualityBadgeTooltip.high };
    if (score >= 75) return { label: dict.details.qualityBadge.good, tooltip: dict.details.qualityBadgeTooltip.good };
    return { label: dict.details.qualityBadge.decent, tooltip: dict.details.qualityBadgeTooltip.decent };
  };

  const getPopularityBadgeProps = (score: number) => {
    if (score >= 80) return { label: dict.details.popularityBadge.hot, tooltip: dict.details.popularityBadgeTooltip.hot };
    if (score >= 60) return { label: dict.details.popularityBadge.trending, tooltip: dict.details.popularityBadgeTooltip.trending };
    return { label: dict.details.popularityBadge.rising, tooltip: dict.details.popularityBadgeTooltip.rising };
  };

  return (
    <section className="relative min-h-[70vh] md:min-h-[60vh] flex items-end">
      {/* FULL BACKDROP */}
      <HeroBackdrop backdrop={backdrop} poster={poster} />

      {/* Content */}
      <div className="relative w-full pb-8 pt-32 md:pt-48">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-6 md:gap-10 items-end">
          {/* Poster - LARGE & PROMINENT */}
          <div className="flex-shrink-0 w-32 md:w-48 lg:w-56">
            <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-zinc-800 shadow-2xl ring-1 ring-white/20">
              {poster?.large && (
                <Image
                  src={poster.large}
                  alt={title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 128px, (max-width: 1024px) 192px, 224px"
                  priority
                />
              )}
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
              {formatYear(releaseDate)}{genres && genres.length > 0 && ` • ${genres.map(g => g.name).join(', ')}`}
            </p>

            {/* Ratings and stats - VERTICAL LAYOUT */}
            <div className="space-y-3">
              {/* Ratings row */}
              <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                {/* Primary rating - qualityScore (Ratingo rating) with tooltip */}
                {rating != null && (
                  <div className="flex items-center gap-2 bg-zinc-900/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <Activity className="w-6 h-6 text-blue-400" />
                    <span className="text-xl md:text-2xl font-bold text-white">{formatRating(rating)}</span>
                    
                    {/* Info icon with tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            type="button"
                            className="ml-1 text-gray-500 hover:text-gray-400 transition-colors cursor-help"
                            onClick={(e) => e.preventDefault()}
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm bg-zinc-800 border border-zinc-700">
                          <div className="text-xs leading-relaxed space-y-3">
                            {/* Header */}
                            <div>
                              <p className="font-semibold text-white">{dict.details.ratingTooltip.title}</p>
                              <p className="text-zinc-400 mt-0.5">{dict.details.ratingTooltip.subtitle}</p>
                            </div>
                            
                            {/* What it means */}
                            <div>
                              <p className="font-medium text-white mb-1">{dict.details.ratingTooltip.whatItMeans}</p>
                              <p className="text-zinc-300">{dict.details.ratingTooltip.description}</p>
                            </div>
                            
                            {/* Classic case hint */}
                            {isClassicCase && (
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1.5">
                                <p className="text-blue-300 font-medium">💡 {dict.details.ratingTooltip.classicCase}</p>
                              </div>
                            )}
                            
                            {/* How to read */}
                            <div>
                              <p className="font-medium text-white mb-1.5">{dict.details.ratingTooltip.howToRead}</p>
                              <ul className="text-zinc-300 space-y-1.5">
                                <li>• {dict.details.ratingTooltip.exampleHigh}</li>
                                <li>• {dict.details.ratingTooltip.exampleTrending}</li>
                              </ul>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {/* IMDb rating */}
                {imdbRating != null && imdbRating !== rating && (
                  <RatingBadge source="IMDb" rating={imdbRating} />
                )}

                {/* TMDB rating */}
                {externalRatings?.tmdb?.rating != null && externalRatings.tmdb.rating !== rating && (
                  <RatingBadge source="TMDB" rating={externalRatings.tmdb.rating} />
                )}

                {/* Trakt rating */}
                {externalRatings?.trakt?.rating != null && externalRatings.trakt.rating !== rating && (
                  <RatingBadge source="Trakt" rating={externalRatings.trakt.rating} />
                )}

                {/* Rotten Tomatoes rating */}
                {externalRatings?.rottenTomatoes?.rating != null && (
                  <RatingBadge source="RT" rating={externalRatings.rottenTomatoes.rating} isPercentage />
                )}
              </div>

              {/* Quality & Popularity badges */}
              {(stats?.qualityScore != null && stats.qualityScore >= 65) || (stats?.popularityScore != null && stats.popularityScore >= 40) ? (
                <div className="flex items-center gap-3 flex-wrap">
                  {stats?.qualityScore != null && stats.qualityScore >= 65 && (
                    <QualityBadge 
                      score={stats.qualityScore} 
                      {...getQualityBadgeProps(stats.qualityScore)}
                    />
                  )}
                  {stats?.popularityScore != null && stats.popularityScore >= 40 && (
                    <PopularityBadge 
                      score={stats.popularityScore} 
                      {...getPopularityBadgeProps(stats.popularityScore)}
                    />
                  )}
                </div>
              ) : null}

              {/* Live watchers & Total watchers */}
              <WatchersStats 
                stats={stats} 
                dict={{
                  watchingNow: dict.details.watchingNow,
                  totalWatchers: dict.details.totalWatchers,
                }}
              />

              {/* Status badges */}
              <StatusBadges 
                badgeKey={badgeKey} 
                rank={rank} 
                dict={{ badge: dict.card.badge }}
              />
            </div>

            {/* Quick Pitch - Interactive scroll to overview */}
            {quickPitch && <QuickPitchScroll text={quickPitch} />}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
