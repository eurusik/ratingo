/**
 * Server-safe media card for SSR/SSG.
 *
 * Uses types from @ratingo/api-contract.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Star, Eye, Calendar, Film, Tv, Flame, Sparkles, TrendingUp, Clapperboard, Info, Bookmark, ArrowRight, MapPin } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import { cn } from '@/shared/utils';
import { formatNumber, formatRating, formatDate, formatYear } from '@/shared/utils/format';
import { getDictionary, type Locale } from '@/shared/i18n';

// Re-export types from contract
type BadgeKey = NonNullable<components['schemas']['CardMetaDto']['badgeKey']>;
type CtaType = components['schemas']['CardMetaDto']['primaryCta'] | 'WHERE_TO_WATCH';
type ImageDto = components['schemas']['ImageDto'];
type RatingoStatsDto = components['schemas']['RatingoStatsDto'];
type ExternalRatingsDto = components['schemas']['ExternalRatingsDto'];
type ShowProgressDto = components['schemas']['ShowProgressDto'];

/** Props for MediaCardServer - simplified view props. */
export interface MediaCardServerProps {
  id: string;
  slug: string;
  type: 'movie' | 'show';
  title: string;
  poster?: ImageDto | null;
  stats?: RatingoStatsDto | null;
  externalRatings?: ExternalRatingsDto | null;
  showProgress?: ShowProgressDto | null;
  releaseDate?: string | null;
  badgeKey?: BadgeKey | null;
  ctaType?: CtaType;
  continuePoint?: { season: number; episode: number } | null;
  rank?: number;
  locale?: Locale;
}

// Badge config
const badgeConfig: Record<BadgeKey, { labelKey: 'trending' | 'newRelease' | 'rising' | 'newEpisode'; icon: typeof Flame; className: string }> = {
  TRENDING: { labelKey: 'trending', icon: Flame, className: 'bg-red-600 text-white' },
  NEW_RELEASE: { labelKey: 'newRelease', icon: Sparkles, className: 'bg-green-500 text-white' },
  RISING: { labelKey: 'rising', icon: TrendingUp, className: 'bg-orange-500 text-white' },
  NEW_EPISODE: { labelKey: 'newEpisode', icon: Clapperboard, className: 'bg-purple-500 text-white' },
  CONTINUE: { labelKey: 'trending', icon: Flame, className: '' },
  IN_WATCHLIST: { labelKey: 'trending', icon: Flame, className: '' },
};

// CTA config
const ctaConfig: Record<CtaType, { labelKey: 'details' | 'save' | 'continue' | 'whereToWatch'; icon: typeof Info; variant: string }> = {
  OPEN: { labelKey: 'details', icon: Info, variant: 'bg-white/10 hover:bg-white/20 text-white' },
  SAVE: { labelKey: 'save', icon: Bookmark, variant: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400' },
  CONTINUE: { labelKey: 'continue', icon: ArrowRight, variant: 'bg-green-500/20 hover:bg-green-500/30 text-green-400' },
  WHERE_TO_WATCH: { labelKey: 'whereToWatch', icon: MapPin, variant: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400' },
};

/**
 * SSR-safe media card component.
 *
 * Renders entirely on the server for SEO. All translations
 * are resolved at build/request time.
 */
export function MediaCardServer(props: MediaCardServerProps) {
  const {
    id,
    slug,
    type,
    title,
    poster,
    stats,
    externalRatings,
    showProgress: progress,
    releaseDate,
    rank,
    badgeKey,
    ctaType = 'OPEN',
    continuePoint,
    locale = 'uk',
  } = props;

  const dict = getDictionary(locale);

  // Derived values
  const posterUrl = poster?.medium ?? null;
  const rating = stats?.ratingoScore ?? stats?.qualityScore ?? null;
  const ratingImdb = externalRatings?.imdb?.rating ?? null;
  const watchers = stats?.liveWatchers ?? null;
  const href = type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`;

  // Show season progress only for shows with progress data
  const hasProgress = type === 'show' && progress?.season != null && progress?.episode != null;

  // Get CTA label
  const ctaCfg = ctaConfig[ctaType];
  const CtaIcon = ctaCfg.icon;
  let ctaLabel = dict.card.cta[ctaCfg.labelKey];
  if (ctaType === 'CONTINUE' && continuePoint) {
    ctaLabel = `${ctaLabel} S${continuePoint.season}E${continuePoint.episode}`;
  }

  return (
    <Link href={href as Route} className="block h-full">
      <article
        className={cn(
          'group relative h-full flex flex-col',
          'bg-zinc-900/50 backdrop-blur rounded-xl overflow-hidden',
          'transition-all duration-300',
          'hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20',
          'hover:ring-2 hover:ring-blue-500/50'
        )}
      >
        {/* Poster */}
        <div className="aspect-[2/3] relative bg-zinc-800 overflow-hidden">
          {posterUrl ? (
            <>
              <Image
                src={posterUrl}
                alt={title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <div className="text-center">
                {type === 'movie' ? <Film className="w-12 h-12 mx-auto mb-2" /> : <Tv className="w-12 h-12 mx-auto mb-2" />}
                <div className="text-sm">{dict.card.noPoster}</div>
              </div>
            </div>
          )}

          {/* Rank badge */}
          {rank != null && rank <= 3 && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold bg-yellow-400 text-black">
              №{rank}
            </div>
          )}

          {/* Status badge */}
          {badgeKey && badgeConfig[badgeKey].className && (
            <div className={cn('absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold', badgeConfig[badgeKey].className)}>
              {(() => { const Icon = badgeConfig[badgeKey].icon; return <Icon className="w-3 h-3" />; })()}
              <span>{dict.card.badge[badgeConfig[badgeKey].labelKey]}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          {/* Title */}
          <h3 className="font-semibold text-white text-sm line-clamp-2 mb-2 min-h-[2.5rem] break-words group-hover:text-blue-400 transition-colors">
            {title}
          </h3>

          {/* Ratings */}
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-white font-semibold">{formatRating(rating)}</span>
              </div>
              {ratingImdb != null && ratingImdb !== rating && (
                <div className="flex items-center space-x-1">
                  <span className="text-yellow-300 font-medium">IMDb</span>
                  <span className="text-white font-semibold">{formatRating(ratingImdb)}</span>
                </div>
              )}
            </div>
            {watchers != null && watchers > 0 && (
              <div className="flex items-center space-x-1 text-gray-300">
                <Eye className="w-3 h-3 text-blue-400" />
                <span>{formatNumber(watchers)}</span>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Episode info or release year */}
          {type === 'show' && progress?.label ? (
            <div className="flex items-center space-x-2 text-xs mb-2">
              <span className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-white">
                {progress.label}
              </span>
              {progress.nextAirDate && <span className="text-gray-300">{formatDate(progress.nextAirDate)}</span>}
            </div>
          ) : type === 'movie' && releaseDate ? (
            <div className="mb-2 text-xs text-gray-400 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{formatYear(releaseDate)}</span>
            </div>
          ) : (
            <div className="mb-2 h-5" />
          )}

          {/* Season progress */}
          {hasProgress && progress ? (
            <div className="text-xs text-zinc-400 mb-3">
              <span className="text-zinc-500">{dict.card.season.released}:</span>
              <span className="ml-1">S{progress.season}</span>
              <span className="mx-1">•</span>
              <span>E{progress.episode}</span>
            </div>
          ) : (
            <div className="mb-3 h-4" />
          )}

          {/* CTA Button */}
          <div className={cn('w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200', ctaCfg.variant)}>
            <CtaIcon className="w-4 h-4" />
            <span>{ctaLabel}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
