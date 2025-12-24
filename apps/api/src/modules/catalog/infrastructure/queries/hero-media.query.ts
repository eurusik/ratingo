import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, desc, and, lte, isNotNull, gte, inArray, isNull } from 'drizzle-orm';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { ImageMapper } from '../mappers/image.mapper';
import {
  HERO_MIN_POPULARITY_SCORE,
  HERO_MIN_QUALITY_SCORE,
  NEW_RELEASE_DAYS_THRESHOLD,
  CLASSIC_YEARS_THRESHOLD,
} from '../../../../common/constants';
import { HeroMediaItem, HeroShowProgress } from '../../domain/models/hero-media.model';

/**
 * Options for hero media query.
 */
export interface HeroMediaOptions {
  limit: number;
  type?: MediaType;
}

/**
 * Fetches top media items for the Hero block on homepage.
 *
 * Retrieves high-quality, popular media with proper assets (posters/backdrops).
 * For TV shows, also fetches episode progress using optimized batch queries.
 *
 * @throws Returns empty array on error (non-critical feature)
 */
@Injectable()
export class HeroMediaQuery {
  private readonly logger = new Logger(HeroMediaQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the hero media query.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * @param {HeroMediaOptions} options - Query options (limit, optional type filter)
   * @returns {Promise<HeroMediaItem[]>} List of hero-worthy media items
   */
  async execute(options: HeroMediaOptions): Promise<HeroMediaItem[]> {
    const { limit, type } = options;

    try {
      const now = new Date();

      const whereConditions = [
        lte(schema.mediaItems.releaseDate, now),
        isNotNull(schema.mediaItems.posterPath),
        isNotNull(schema.mediaItems.backdropPath),
        gte(schema.mediaStats.qualityScore, HERO_MIN_QUALITY_SCORE),
        gte(schema.mediaStats.popularityScore, HERO_MIN_POPULARITY_SCORE),
        // Eligibility filter: only show ELIGIBLE items
        eq(schema.mediaCatalogEvaluations.status, 'eligible'),
        // Ready filter: only show items with ready ingestion status
        eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
        // Not deleted filter
        isNull(schema.mediaItems.deletedAt),
      ];

      if (type) {
        whereConditions.push(eq(schema.mediaItems.type, type));
      }

      const results = await this.db
        .select({
          id: schema.mediaItems.id,
          type: schema.mediaItems.type,
          slug: schema.mediaItems.slug,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          overview: schema.mediaItems.overview,
          posterPath: schema.mediaItems.posterPath,
          backdropPath: schema.mediaItems.backdropPath,
          releaseDate: schema.mediaItems.releaseDate,
          videos: schema.mediaItems.videos,

          ratingoScore: schema.mediaStats.ratingoScore,
          qualityScore: schema.mediaStats.qualityScore,
          watchersCount: schema.mediaStats.watchersCount,
          totalWatchers: schema.mediaStats.totalWatchers,

          rating: schema.mediaItems.rating,
          voteCount: schema.mediaItems.voteCount,
          ratingImdb: schema.mediaItems.ratingImdb,
          voteCountImdb: schema.mediaItems.voteCountImdb,
          ratingTrakt: schema.mediaItems.ratingTrakt,
          voteCountTrakt: schema.mediaItems.voteCountTrakt,
          ratingMetacritic: schema.mediaItems.ratingMetacritic,
          ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
        })
        .from(schema.mediaItems)
        .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
        .innerJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
            eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          ),
        )
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...whereConditions))
        .orderBy(desc(schema.mediaStats.popularityScore), desc(schema.mediaStats.ratingoScore))
        .limit(limit);

      const showProgressMap = await this.fetchShowProgress(results, now);

      return this.mapResults(results, showProgressMap, now);
    } catch (error) {
      this.logger.error(`Failed to find hero items: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Fetches show progress (season/episode) for TV shows in the results.
   */
  private async fetchShowProgress(
    results: Array<{ id: string; type: MediaType }>,
    now: Date,
  ): Promise<Map<string, HeroShowProgress>> {
    const showIds = results.filter((r) => r.type === MediaType.SHOW).map((r) => r.id);

    const progressMap = new Map<string, HeroShowProgress>();

    if (showIds.length === 0) {
      return progressMap;
    }

    const showsData = await this.db
      .select({
        mediaItemId: schema.shows.mediaItemId,
        showId: schema.shows.id,
        lastAirDate: schema.shows.lastAirDate,
        nextAirDate: schema.shows.nextAirDate,
      })
      .from(schema.shows)
      .where(inArray(schema.shows.mediaItemId, showIds));

    const internalShowIds = showsData.map((s) => s.showId);

    if (internalShowIds.length === 0) {
      return progressMap;
    }

    const episodes = await this.db
      .select({
        showId: schema.episodes.showId,
        seasonNum: schema.seasons.number,
        episodeNumber: schema.episodes.number,
        airDate: schema.episodes.airDate,
      })
      .from(schema.episodes)
      .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
      .where(
        and(inArray(schema.episodes.showId, internalShowIds), lte(schema.episodes.airDate, now)),
      )
      .orderBy(desc(schema.episodes.airDate));

    // Group by showId and pick first (latest)
    const latestEpisodeMap = new Map<string, any>();
    for (const ep of episodes) {
      if (!latestEpisodeMap.has(ep.showId)) {
        latestEpisodeMap.set(ep.showId, ep);
      }
    }

    // Build the result map
    for (const show of showsData) {
      const ep = latestEpisodeMap.get(show.showId);
      if (ep) {
        progressMap.set(show.mediaItemId, {
          season: ep.seasonNum,
          episode: ep.episodeNumber,
          label: `S${ep.seasonNum}E${ep.episodeNumber}`,
          lastAirDate: show.lastAirDate,
          nextAirDate: show.nextAirDate,
        });
      } else if (show.lastAirDate) {
        progressMap.set(show.mediaItemId, {
          season: null,
          episode: null,
          label: null,
          lastAirDate: show.lastAirDate,
          nextAirDate: show.nextAirDate,
        });
      }
    }

    return progressMap;
  }

  private extractPrimaryTrailerKey(videos: unknown): string | null {
    if (!Array.isArray(videos) || videos.length === 0) return null;
    const first = videos[0];
    if (!first || typeof first !== 'object') return null;
    const key = (first as Record<string, unknown>).key;
    return typeof key === 'string' ? key : null;
  }

  /**
   * Maps raw database rows to hero item DTOs.
   */
  private mapResults(
    results: Array<{
      id: string;
      type: MediaType;
      slug: string;
      title: string;
      originalTitle: string | null;
      overview: string | null;
      posterPath: string | null;
      backdropPath: string | null;
      releaseDate: Date | null;
      videos: unknown;
      ratingoScore: number | null;
      qualityScore: number | null;
      watchersCount: number | null;
      totalWatchers: number | null;
      rating: number;
      voteCount: number;
      ratingImdb: number | null;
      voteCountImdb: number | null;
      ratingTrakt: number | null;
      voteCountTrakt: number | null;
      ratingMetacritic: number | null;
      ratingRottenTomatoes: number | null;
    }>,
    showProgressMap: Map<string, HeroShowProgress>,
    now: Date,
  ): HeroMediaItem[] {
    const ninetyDaysAgo = new Date(
      now.getTime() - NEW_RELEASE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000,
    );
    const fiveYearsAgo = new Date(
      now.getFullYear() - CLASSIC_YEARS_THRESHOLD,
      now.getMonth(),
      now.getDate(),
    );

    return results.map((item) => {
      const releaseDate = item.releaseDate ? new Date(item.releaseDate) : null;
      const primaryTrailerKey = this.extractPrimaryTrailerKey(item.videos);

      const baseItem = {
        id: item.id,
        mediaItemId: item.id,
        type: item.type,
        slug: item.slug,
        title: item.title,
        originalTitle: item.originalTitle,
        overview: item.overview,
        primaryTrailerKey,
        poster: ImageMapper.toPoster(item.posterPath),
        backdrop: ImageMapper.toBackdrop(item.backdropPath),
        releaseDate: item.releaseDate,
        isNew: releaseDate ? releaseDate >= ninetyDaysAgo : false,
        isClassic: releaseDate ? releaseDate <= fiveYearsAgo : false,
        stats: {
          ratingoScore: item.ratingoScore,
          qualityScore: item.qualityScore,
          liveWatchers: item.watchersCount,
          totalWatchers: item.totalWatchers,
        },
        externalRatings: {
          tmdb: { rating: item.rating, voteCount: item.voteCount },
          imdb: item.ratingImdb ? { rating: item.ratingImdb, voteCount: item.voteCountImdb } : null,
          trakt: item.ratingTrakt
            ? { rating: item.ratingTrakt, voteCount: item.voteCountTrakt }
            : null,
          metacritic: item.ratingMetacritic ? { rating: item.ratingMetacritic } : null,
          rottenTomatoes: item.ratingRottenTomatoes ? { rating: item.ratingRottenTomatoes } : null,
        },
      };

      if (item.type === MediaType.SHOW) {
        const progress = showProgressMap.get(item.id);
        if (progress) {
          return { ...baseItem, showProgress: progress };
        }
      }

      return baseItem;
    });
  }
}
