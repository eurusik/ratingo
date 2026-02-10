import { type IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { type MovieStatus } from '../../../../../common/enums/movie-status.enum';
import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import { type MovieDetails } from '../../../domain/repositories/movie.repository.interface';
import { type GenreInfo } from '../../../domain/types/common.types';
import { CreditsMapper } from '../../mappers/credits.mapper';
import {
  MediaWatchOffersMapper,
  type WatchOfferRow,
} from '../../mappers/media-watch-offers.mapper';

/**
 * Raw row type from movie details query.
 * Explicit types for all 36 fields to ensure type safety.
 */
export interface MovieDetailsQueryRow {
  // Core media item fields
  id: string;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  posterPath: string | null;
  ingestionStatus: string;
  backdropPath: string | null;
  rating: number;
  voteCount: number;
  releaseDate: Date | null;
  videos: unknown;
  credits: unknown;
  watchProvidersRaw: unknown;

  // External ratings
  ratingImdb: number | null;
  voteCountImdb: number | null;
  ratingTrakt: number | null;
  voteCountTrakt: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;

  // Movie-specific fields
  runtime: number | null;
  budget: number | null;
  revenue: number | null;
  status: string | null;
  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;

  // Stats
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
export function mapExternalRatings(row: MovieDetailsQueryRow) {
  return {
    tmdb: { rating: row.rating, voteCount: row.voteCount },
    imdb: row.ratingImdb ? { rating: row.ratingImdb, voteCount: row.voteCountImdb } : null,
    trakt: row.ratingTrakt ? { rating: row.ratingTrakt, voteCount: row.voteCountTrakt } : null,
    metacritic: row.ratingMetacritic ? { rating: row.ratingMetacritic } : null,
    rottenTomatoes: row.ratingRottenTomatoes ? { rating: row.ratingRottenTomatoes } : null,
  };
}

/**
 * Maps Ratingo stats from raw row to structured RatingoStats object.
 */
export function mapRatingoStats(row: MovieDetailsQueryRow) {
  return {
    ratingoScore: row.ratingoScore,
    qualityScore: row.qualityScore,
    popularityScore: row.popularityScore,
    liveWatchers: row.watchersCount,
    totalWatchers: row.totalWatchers,
    communityAverageRating: row.communityAverageRating,
    communityRatingCount: row.communityRatingCount,
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
 * Maps raw database row to MovieDetails domain object.
 *
 * @param row - Raw query result row
 * @param genres - Genre info from GenreQuery
 * @param watchOffers - Watch offers from WatchOffersQuery
 * @returns MovieDetails domain object
 */
export function mapMovieDetails(
  row: MovieDetailsQueryRow,
  genres: GenreInfo[],
  watchOffers: WatchOfferRow[],
): MovieDetails {
  return {
    id: row.id,
    tmdbId: row.tmdbId,
    title: row.title,
    originalTitle: row.originalTitle,
    slug: row.slug,
    overview: row.overview,
    ingestionStatus: row.ingestionStatus as IngestionStatus,
    poster: ImageMapper.toPoster(row.posterPath),
    backdrop: ImageMapper.toBackdrop(row.backdropPath),
    releaseDate: row.releaseDate ?? row.theatricalReleaseDate ?? null,
    videos: row.videos as MovieDetails['videos'],
    primaryTrailer: extractPrimaryTrailer(row.videos),
    credits: CreditsMapper.toDto(row.credits as Parameters<typeof CreditsMapper.toDto>[0]),
    availability: MediaWatchOffersMapper.toAvailability(
      watchOffers,
      row.watchProvidersRaw as Parameters<typeof MediaWatchOffersMapper.toAvailability>[1],
    ),

    runtime: row.runtime ?? null,
    budget: row.budget ?? null,
    revenue: row.revenue ?? null,
    status: row.status ? (row.status as MovieStatus) : null,
    theatricalReleaseDate: row.theatricalReleaseDate ?? null,
    digitalReleaseDate: row.digitalReleaseDate ?? null,

    stats: mapRatingoStats(row),
    externalRatings: mapExternalRatings(row),

    genres,
  };
}
