import { IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import { hasRecentEpisode } from '../../../../../common/utils/media.utils';
import type { TrendingShowItem } from '../../../domain/repositories/show.repository.interface';

import { calculateReleaseFlags } from './release-flags.util';
import type { ShowSelectRow } from './show-select.fields';

/**
 * Show progress information for display.
 */
export interface ShowProgress {
  lastAirDate: Date | null;
  nextAirDate: Date | null;
  season: number | null;
  episode: number | null;
  label: string | null;
}

/**
 * Shared mapper for show query results.
 * Eliminates duplication between PopularShowsQuery and TrendingShowsQuery.
 */
export class ShowResultMapper {
  /**
   * Builds show progress object with season/episode label.
   *
   * @param row - Database row with show progress fields
   * @returns ShowProgress object with formatted label
   */
  static buildShowProgress(row: ShowSelectRow): ShowProgress {
    let label: string | null = null;
    if (row.season_number != null && row.episode_number != null) {
      label = `S${row.season_number}E${row.episode_number}`;
    }

    return {
      lastAirDate: row.last_air_date ? new Date(row.last_air_date) : null,
      nextAirDate: row.next_air_date ? new Date(row.next_air_date) : null,
      season: row.season_number ?? null,
      episode: row.episode_number ?? null,
      label,
    };
  }

  /**
   * Maps a single database row to TrendingShowItem DTO.
   *
   * @param row - Database row from show query
   * @returns TrendingShowItem with all fields populated
   */
  static toTrendingItem(row: ShowSelectRow): TrendingShowItem {
    const releaseDate = row.release_date ? new Date(row.release_date) : null;
    const { isNew, isClassic } = calculateReleaseFlags(
      releaseDate,
      row.ratingo_score,
      row.total_watchers,
    );

    return {
      id: row.id,
      mediaItemId: row.id,
      type: MediaType.SHOW,
      slug: row.slug,
      title: row.title,
      originalTitle: row.original_title,
      overview: row.overview,
      ingestionStatus: row.ingestion_status as IngestionStatus,
      primaryTrailerKey: (row.videos as Array<{ key?: string }> | null)?.[0]?.key || null,
      poster: ImageMapper.toPoster(row.poster_path),
      backdrop: ImageMapper.toBackdrop(row.backdrop_path),
      releaseDate,

      isNew,
      isClassic,

      stats: {
        ratingoScore: row.ratingo_score,
        qualityScore: row.quality_score,
        popularityScore: row.popularity_score,
        liveWatchers: row.watchers_count,
        totalWatchers: row.total_watchers,
        communityAverageRating: null,
        communityRatingCount: null,
      },
      externalRatings: {
        tmdb: { rating: row.rating, voteCount: row.vote_count },
        imdb: row.rating_imdb ? { rating: row.rating_imdb, voteCount: row.vote_count_imdb } : null,
        trakt: row.rating_trakt
          ? { rating: row.rating_trakt, voteCount: row.vote_count_trakt }
          : null,
        metacritic: row.rating_metacritic ? { rating: row.rating_metacritic } : null,
        rottenTomatoes: row.rating_rotten_tomatoes ? { rating: row.rating_rotten_tomatoes } : null,
      },

      showProgress: this.buildShowProgress(row),

      hasRecentEpisode: hasRecentEpisode(row.last_air_date),
    };
  }

  /**
   * Maps multiple database rows to TrendingShowItem array.
   *
   * @param rows - Array of database rows from show query
   * @returns Array of TrendingShowItem DTOs
   */
  static mapManyTrending(rows: ShowSelectRow[]): TrendingShowItem[] {
    return rows.map((row) => this.toTrendingItem(row));
  }
}
