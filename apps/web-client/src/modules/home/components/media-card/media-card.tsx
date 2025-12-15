/**
 * Media card component for movies and shows.
 *
 * Unified card with poster, ratings, episode info, progress, and CTA.
 * Supports both movie and show types with type-safe props.
 */

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils';
import { formatYear } from '@/shared/utils/format';
import { CardPoster } from './card-poster';
import { CardRating } from './card-rating';
import { CardEpisodeInfo } from './card-episode-info';
import { CardProgress, SeasonProgress } from './card-progress';
import { CardCta } from './card-cta';
import { CardBadge, RankBadge } from './card-badge';

type BadgeKey = 'NEW_EPISODE' | 'CONTINUE' | 'IN_WATCHLIST' | 'NEW_RELEASE' | 'RISING' | 'TRENDING';
type CtaType = 'SAVE' | 'CONTINUE' | 'OPEN';

/** Base props for all media cards. */
interface BaseMediaCardProps {
  /** Unique media item ID. */
  id: string;
  /** Display title (Ukrainian preferred). */
  title: string;
  /** TMDB poster URL (small size). */
  posterUrl: string | null;
  /** Primary rating (TMDB → Trakt → IMDb). */
  rating?: number | null;
  /** IMDb rating. */
  ratingImdb?: number | null;
  /** Current watchers count. */
  watchers?: number | null;
  /** Detail page URL. */
  href: string;
  /** Rank in trending (1-3 shows badge). */
  rank?: number;
  /** Badge from CardMetaDto. */
  badgeKey?: BadgeKey | null;
  /** CTA type from CardMetaDto. */
  ctaType?: CtaType;
  /** Continue point for shows. */
  continuePoint?: { season: number; episode: number } | null;
  /** Click handler for CTA button. */
  onCtaClick?: (e: React.MouseEvent) => void;
}

/** Show-specific props. */
interface ShowCardProps extends BaseMediaCardProps {
  type: 'show';
  /** Next episode season. */
  nextEpisodeSeason?: number;
  /** Next episode number. */
  nextEpisodeNumber?: number;
  /** Next episode air date. */
  nextEpisodeAirDate?: string | null;
  /** Total episodes in current season. */
  latestSeasonEpisodes?: number;
  /** Last watched episode number. */
  lastEpisodeNumber?: number;
}

/** Movie-specific props. */
interface MovieCardProps extends BaseMediaCardProps {
  type: 'movie';
  /** Movie release date. */
  releaseDate?: string | null;
}

export type MediaCardProps = ShowCardProps | MovieCardProps;

/**
 * Unified media card for trending grids.
 *
 * Features:
 * - Poster with rank/trending badges
 * - Title with hover effect
 * - Rating row (TMDB + IMDb + watchers)
 * - Episode info (shows only)
 * - Progress bar (shows only)
 * - Smart CTA button
 *
 * @example
 * <MediaCard
 *   type="show"
 *   id="123"
 *   title="Країна Вогню"
 *   posterUrl="https://..."
 *   rating={8.2}
 *   ratingImdb={7.1}
 *   watchers={1200}
 *   href="/shows/kraina-vohnyu"
 *   rank={1}
 *   badgeKey="TRENDING"
 *   ctaType="OPEN"
 *   nextEpisodeSeason={4}
 *   nextEpisodeNumber={9}
 *   nextEpisodeAirDate="2025-12-19"
 *   latestSeasonEpisodes={12}
 *   lastEpisodeNumber={8}
 * />
 */
export function MediaCard(props: MediaCardProps) {
  const {
    id,
    title,
    posterUrl,
    rating,
    ratingImdb,
    watchers,
    href,
    rank,
    badgeKey,
    ctaType = 'OPEN',
    continuePoint,
    onCtaClick,
    type,
  } = props;

  // Show season progress ONLY for shows with episode data
  // Uses text format, not video-style bar (avoids player mental model)
  const showProgress =
    type === 'show' &&
    props.latestSeasonEpisodes != null &&
    props.lastEpisodeNumber != null &&
    props.latestSeasonEpisodes > 0 &&
    props.nextEpisodeSeason != null;

  // Handle CTA click (prevent navigation if custom handler)
  const handleCtaClick = (e: React.MouseEvent) => {
    if (onCtaClick) {
      e.preventDefault();
      e.stopPropagation();
      onCtaClick(e);
    }
  };

  return (
    <Link href={href as Route} className="block h-full">
      <div
        className={cn(
          'group relative h-full flex flex-col',
          'bg-zinc-900/50 backdrop-blur rounded-xl overflow-hidden',
          'transition-all duration-300',
          'hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20',
          'hover:ring-2 hover:ring-blue-500/50'
        )}
      >
        {/* Poster with badges */}
        <CardPoster src={posterUrl} alt={title} type={type}>
          {rank != null && rank <= 3 && <RankBadge rank={rank} />}
          {badgeKey && <CardBadge badgeKey={badgeKey} position="top-right" />}
        </CardPoster>

        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          {/* Title */}
          <h3
            className={cn(
              'font-semibold text-white text-sm line-clamp-2 mb-2',
              'min-h-[2.5rem] break-words',
              'group-hover:text-blue-400 transition-colors'
            )}
          >
            {title}
          </h3>

          {/* Rating row */}
          <CardRating rating={rating} ratingImdb={ratingImdb} watchers={watchers} className="mb-2" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Episode info (shows) or Release year (movies) */}
          {type === 'show' && props.nextEpisodeNumber != null && props.nextEpisodeSeason != null ? (
            <CardEpisodeInfo
              season={props.nextEpisodeSeason}
              episode={props.nextEpisodeNumber}
              airDate={props.nextEpisodeAirDate}
              className="mb-2"
            />
          ) : type === 'movie' && props.releaseDate ? (
            <div className="mb-2 text-xs text-gray-400 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{formatYear(props.releaseDate)}</span>
            </div>
          ) : (
            <div className="mb-2 h-5" />
          )}

          {/* Season progress (shows only) - TEXT, not bar */}
          {showProgress ? (
            <SeasonProgress
              season={props.nextEpisodeSeason!}
              current={props.lastEpisodeNumber!}
              total={props.latestSeasonEpisodes!}
              variant="text"
              className="mb-3"
            />
          ) : (
            <div className="mb-3 h-4" />
          )}

          {/* CTA Button */}
          <CardCta type={ctaType} continuePoint={continuePoint} onClick={handleCtaClick} />
        </div>
      </div>
    </Link>
  );
}
