/**
 * Media card component for movies and shows.
 */

'use client';

import { Calendar } from 'lucide-react';
import type { components } from '@ratingo/api-contract';
import { cn } from '@/shared/utils';
import { formatYear } from '@/shared/utils/format';
import { useTranslation } from '@/shared/i18n';
import { CardLayout, cardTitleStyles } from './card-layout';
import { CardPoster } from './card-poster';
import { CardRating } from './card-rating';
import { CardEpisodeInfo } from './card-episode-info';
import { SeasonProgress } from './card-progress';
import { CardBookmark } from './card-cta';
import { CardBadge, RankBadge, badgeLabelKeys } from './card-badge';

// Re-use types from API contract
type BadgeKey = NonNullable<components['schemas']['CardMetaDto']['badgeKey']>;

/** Base props for all media cards. */
interface BaseMediaCardProps {
  /** Unique media item ID. */
  id: string;
  /** Display title (Ukrainian preferred). */
  title: string;
  /** TMDB poster URL (small size). */
  posterUrl: string | null;
  /** Primary Ratingo score (qualityScore) - актуальність. */
  rating?: number | null;
  /** Current watchers count - соціальний сигнал. */
  watchers?: number | null;
  /** Detail page URL. */
  href: string;
  /** Rank in trending (1-3 shows badge). */
  rank?: number;
  /** Badge from CardMetaDto (nullable from backend). */
  badgeKey?: BadgeKey | null;
  /** Whether item is bookmarked. */
  isBookmarked?: boolean;
  /** Bookmark click handler. */
  onBookmarkClick?: (e: React.MouseEvent) => void;
}

/** Show-specific props. */
interface ShowCardProps extends BaseMediaCardProps {
  type: 'show';
  /** Next episode season. */
  nextEpisodeSeason?: number;
  /** Next episode number. */
  nextEpisodeNumber?: number;
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
 * Minimalist media card for trending grids.
 */
export function MediaCard(props: MediaCardProps) {
  const { t } = useTranslation();
  const {
    id,
    title,
    posterUrl,
    rating,
    watchers,
    href,
    rank,
    badgeKey,
    isBookmarked = false,
    onBookmarkClick,
    type,
  } = props;

  const showProgress =
    type === 'show' &&
    props.latestSeasonEpisodes != null &&
    props.lastEpisodeNumber != null &&
    props.latestSeasonEpisodes > 0 &&
    props.nextEpisodeSeason != null;

  const posterSlot = (
    <CardPoster src={posterUrl} alt={title} type={type} noPosterText={t('card.noPoster')}>
      {/* Priority: Rank badge (№1-3) OR Status badge (🔥 Trending) */}
      {rank != null && rank <= 3 ? (
        <RankBadge rank={rank} />
      ) : badgeKey ? (
        <CardBadge badgeKey={badgeKey} label={t(`card.badge.${badgeLabelKeys[badgeKey]}`)} position="top-right" />
      ) : null}
    </CardPoster>
  );

  const overlaySlot = (
    <CardBookmark isBookmarked={isBookmarked} onClick={onBookmarkClick} />
  );

  return (
    <CardLayout href={href} poster={posterSlot} overlay={overlaySlot}>
      {/* Title */}
      <h3 className={cn(cardTitleStyles)}>
        {title}
      </h3>

      {/* ⚡ актуальність + 👁 онлайн (one rating only) */}
      <CardRating rating={rating} watchers={watchers} className="mb-3" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Minimal context: S4E9 or Year */}
      {type === 'show' && props.nextEpisodeNumber != null && props.nextEpisodeSeason != null ? (
        <CardEpisodeInfo
          season={props.nextEpisodeSeason}
          episode={props.nextEpisodeNumber}
        />
      ) : type === 'movie' && props.releaseDate ? (
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{formatYear(props.releaseDate)}</span>
        </div>
      ) : null}

      {/* Progress bar (only if user is watching - CONTINUE_LIST) */}
      {showProgress && (
        <SeasonProgress
          season={props.nextEpisodeSeason!}
          current={props.lastEpisodeNumber!}
          total={props.latestSeasonEpisodes!}
          variant="text"
          className="mt-2"
        />
      )}
    </CardLayout>
  );
}
