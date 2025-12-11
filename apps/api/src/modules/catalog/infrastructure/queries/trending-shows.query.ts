import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { sql, SQL } from 'drizzle-orm';
import { MediaType } from '../../../../common/enums/media-type.enum';
import {
  TrendingShowItem,
  TrendingShowsOptions,
} from '../../domain/repositories/show.repository.interface';
import { ImageMapper } from '../mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

/**
 * Fetches trending TV shows with episode progress.
 *
 * Uses PostgreSQL LATERAL JOIN to efficiently retrieve the latest aired
 * episode for each show in a single query, avoiding N+1 problems.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class TrendingShowsQuery {
  private readonly logger = new Logger(TrendingShowsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>
  ) {}

  /**
   * Executes the trending shows query.
   *
   * @param {TrendingShowsOptions} options - Query options (limit, offset, filters)
   * @returns {Promise<TrendingShowItem[]>} List of trending shows with stats and progress
   * @throws {DatabaseException} When database query fails
   */
  async execute(options: TrendingShowsOptions): Promise<TrendingShowItem[]> {
    const { limit = 20, offset = 0, minRating, genreId } = options;

    try {
      const whereConditions: SQL[] = [sql`mi.type = ${MediaType.SHOW}`, sql`mi.deleted_at IS NULL`];

      if (minRating !== undefined) {
        whereConditions.push(sql`ms.ratingo_score >= ${minRating}`);
      }

      if (genreId) {
        whereConditions.push(sql`
          EXISTS (
            SELECT 1 FROM ${schema.mediaGenres} mg 
            WHERE mg.media_item_id = mi.id AND mg.genre_id = ${genreId}
          )
        `);
      }

      const query = sql`
        SELECT
          mi.id,
          mi.tmdb_id,
          mi.title,
          mi.original_title,
          mi.slug,
          mi.overview,
          mi.poster_path,
          mi.backdrop_path,
          mi.release_date,
          mi.videos,
          mi.ingestion_status,
          
          mi.rating,
          mi.vote_count,
          mi.rating_imdb,
          mi.vote_count_imdb,
          mi.rating_trakt,
          mi.vote_count_trakt,
          mi.rating_metacritic,
          mi.rating_rotten_tomatoes,
          mi.popularity,

          ms.ratingo_score,
          ms.quality_score,
          ms.popularity_score,
          ms.watchers_count,
          ms.total_watchers,

          s.last_air_date,
          s.next_air_date,
          
          se.number AS season_number,
          ep.number AS episode_number

        FROM ${schema.mediaItems} mi
        JOIN ${schema.shows} s ON s.media_item_id = mi.id
        LEFT JOIN ${schema.mediaStats} ms ON ms.media_item_id = mi.id
        
        LEFT JOIN LATERAL (
          SELECT e.season_id, e.number
          FROM ${schema.episodes} e
          WHERE e.show_id = s.id 
            AND e.air_date IS NOT NULL 
            AND e.air_date <= NOW()
          ORDER BY e.air_date DESC
          LIMIT 1
        ) ep ON TRUE
        LEFT JOIN ${schema.seasons} se ON se.id = ep.season_id

        WHERE ${sql.join(whereConditions, sql` AND `)}
        
        ORDER BY 
          ms.popularity_score DESC NULLS LAST,
          ms.ratingo_score DESC NULLS LAST,
          mi.popularity DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;

      const results = await this.db.execute(query);

      return this.mapResults(results);
    } catch (error) {
      this.logger.error(`Failed to find trending shows: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch trending shows', {
        originalError: error.message,
      });
    }
  }

  /**
   * Maps raw database rows to TrendingShowItem DTOs.
   */
  private mapResults(results: any[]): TrendingShowItem[] {
    const now = new Date();
    const newReleaseCutoff = new Date();
    newReleaseCutoff.setDate(now.getDate() - 30);

    const classicCutoff = new Date();
    classicCutoff.setFullYear(now.getFullYear() - 10);

    return results.map((row: any) => {
      const releaseDate = row.release_date ? new Date(row.release_date) : null;

      return {
        id: row.id,
        type: 'show' as const,
        slug: row.slug,
        title: row.title,
        originalTitle: row.original_title,
        overview: row.overview,
        ingestionStatus: row.ingestion_status as IngestionStatus,
        primaryTrailerKey: row.videos?.[0]?.key || null,
        poster: ImageMapper.toPoster(row.poster_path),
        backdrop: ImageMapper.toBackdrop(row.backdrop_path),
        releaseDate,

        isNew: releaseDate ? releaseDate >= newReleaseCutoff : false,
        isClassic: releaseDate
          ? releaseDate <= classicCutoff ||
            ((row.ratingo_score || 0) >= 80 && (row.total_watchers || 0) > 10000)
          : false,

        stats: {
          ratingoScore: row.ratingo_score,
          qualityScore: row.quality_score,
          popularityScore: row.popularity_score,
          liveWatchers: row.watchers_count,
          totalWatchers: row.total_watchers,
        },
        externalRatings: {
          tmdb: { rating: row.rating, voteCount: row.vote_count },
          imdb: row.rating_imdb
            ? { rating: row.rating_imdb, voteCount: row.vote_count_imdb }
            : null,
          trakt: row.rating_trakt
            ? { rating: row.rating_trakt, voteCount: row.vote_count_trakt }
            : null,
          metacritic: row.rating_metacritic ? { rating: row.rating_metacritic } : null,
          rottenTomatoes: row.rating_rotten_tomatoes
            ? { rating: row.rating_rotten_tomatoes }
            : null,
        },

        showProgress: this.buildShowProgress(row),
      };
    });
  }

  /**
   * Builds show progress object with season/episode label.
   */
  private buildShowProgress(row: any) {
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
}
