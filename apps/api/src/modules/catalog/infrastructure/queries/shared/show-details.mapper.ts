import { type IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { type ShowStatus } from '../../../../../common/enums/show-status.enum';
import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import {
  type ShowDetails,
  type SeasonInfo,
} from '../../../domain/repositories/show.repository.interface';
import { type GenreInfo, type RecentRater } from '../../../domain/types/common.types';
import { CreditsMapper } from '../../mappers/credits.mapper';
import {
  MediaWatchOffersMapper,
  type WatchOfferRow,
} from '../../mappers/media-watch-offers.mapper';

/**
 * Raw row type from show details query.
 * Explicit types for all 34 fields to ensure type safety.
 */
export interface ShowDetailsQueryRow {
  // Core media item fields (15)
  id: string;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  posterPath: string | null;
  ingestionStatus: string;
  backdropPath: string | null;
  videos: unknown;
  credits: unknown;
  watchProvidersRaw: unknown;
  rating: number;
  voteCount: number;
  releaseDate: Date | null;

  // External ratings (7)
  ratingImdb: number | null;
  voteCountImdb: number | null;
  ratingTrakt: number | null;
  voteCountTrakt: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;
  ratingRottenTomatoesAudience: number | null;

  // Show-specific fields (6)
  totalSeasons: number | null;
  totalEpisodes: number | null;
  status: string | null;
  lastAirDate: Date | null;
  nextAirDate: Date | null;
  showId: string;

  // Stats (7)
  ratingoScore: number | null;
  qualityScore: number | null;
  popularityScore: number | null;
  watchersCount: number | null;
  totalWatchers: number | null;
  communityAverageRating: number | null;
  communityRatingCount: number | null;
}

/**
 * Maps external ratings from raw row to structured ExternalRatings object.
 */
function mapExternalRatings(row: ShowDetailsQueryRow) {
  return {
    tmdb: { rating: row.rating, voteCount: row.voteCount },
    imdb: row.ratingImdb ? { rating: row.ratingImdb, voteCount: row.voteCountImdb } : null,
    trakt: row.ratingTrakt ? { rating: row.ratingTrakt, voteCount: row.voteCountTrakt } : null,
    metacritic: row.ratingMetacritic != null ? { rating: row.ratingMetacritic } : null,
    rottenTomatoes: row.ratingRottenTomatoes != null ? { rating: row.ratingRottenTomatoes } : null,
    rottenTomatoesAudience:
      row.ratingRottenTomatoesAudience != null
        ? { rating: row.ratingRottenTomatoesAudience }
        : null,
  };
}

/**
 * Maps Ratingo stats from raw row to structured RatingoStats object.
 */
function mapRatingoStats(row: ShowDetailsQueryRow, recentRaters: RecentRater[]) {
  return {
    ratingoScore: row.ratingoScore,
    qualityScore: row.qualityScore,
    popularityScore: row.popularityScore,
    liveWatchers: row.watchersCount,
    totalWatchers: row.totalWatchers,
    communityAverageRating: row.communityAverageRating,
    communityRatingCount: row.communityRatingCount,
    recentRaters,
  };
}

/**
 * Extracts primary trailer from videos array.
 */
function extractPrimaryTrailer(videos: unknown) {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  return videos[0] || null;
}

/**
 * Maps raw database row to ShowDetails domain object.
 *
 * @param row - Raw query result row
 * @param genres - Genre info from GenreQuery
 * @param seasons - Season info with episodes from fetchSeasons
 * @param watchOffers - Watch offers from WatchOffersQuery
 * @returns ShowDetails domain object
 */
export function mapShowDetails(
  row: ShowDetailsQueryRow,
  genres: GenreInfo[],
  seasons: SeasonInfo[],
  watchOffers: WatchOfferRow[],
  recentRaters: RecentRater[],
): ShowDetails {
  return {
    id: row.id,
    showId: row.showId,
    tmdbId: row.tmdbId,
    title: row.title,
    originalTitle: row.originalTitle,
    slug: row.slug,
    overview: row.overview,
    ingestionStatus: row.ingestionStatus as IngestionStatus,
    poster: ImageMapper.toPoster(row.posterPath),
    backdrop: ImageMapper.toBackdrop(row.backdropPath),
    videos: row.videos as ShowDetails['videos'],
    primaryTrailer: extractPrimaryTrailer(row.videos),
    credits: CreditsMapper.toDto(row.credits as Parameters<typeof CreditsMapper.toDto>[0]),
    availability: MediaWatchOffersMapper.toAvailability(
      watchOffers,
      row.watchProvidersRaw as Parameters<typeof MediaWatchOffersMapper.toAvailability>[1],
    ),
    releaseDate: row.releaseDate,

    totalSeasons: row.totalSeasons,
    totalEpisodes: row.totalEpisodes,
    status: row.status as ShowStatus | null,
    lastAirDate: row.lastAirDate,
    nextAirDate: row.nextAirDate,

    stats: mapRatingoStats(row, recentRaters),
    externalRatings: mapExternalRatings(row),

    genres,
    seasons,
  };
}
