/**
 * Dry-Run Repository
 *
 * Database queries for dry-run evaluation.
 */

import { Injectable, Inject } from '@nestjs/common';

import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type IDryRunRepository,
  type DryRunMediaItem,
  type CurrentEvaluation,
} from '../../domain/repositories/dry-run.repository.interface';

const EVALUATION_BATCH_SIZE = 1000;

const DRY_RUN_SELECT_FIELDS = {
  id: schema.mediaItems.id,
  title: schema.mediaItems.title,
  overview: schema.mediaItems.overview,
  originCountries: schema.mediaItems.originCountries,
  originalLanguage: schema.mediaItems.originalLanguage,
  contentClass: schema.mediaItems.contentClass,
  ratingImdb: schema.mediaItems.ratingImdb,
  ratingMetacritic: schema.mediaItems.ratingMetacritic,
  ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
  ratingTrakt: schema.mediaItems.ratingTrakt,
  voteCountImdb: schema.mediaItems.voteCountImdb,
  voteCountTrakt: schema.mediaItems.voteCountTrakt,
  qualityScore: schema.mediaStats.qualityScore,
  popularityScore: schema.mediaStats.popularityScore,
  freshnessScore: schema.mediaStats.freshnessScore,
  ratingoScore: schema.mediaStats.ratingoScore,
};

@Injectable()
export class DryRunRepository implements IDryRunRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async fetchSampleItems(limit: number, samplePercent: number): Promise<DryRunMediaItem[]> {
    const result = await this.db.execute(sql`
      SELECT
        mi.id,
        mi.title,
        mi.overview,
        mi.origin_countries as "originCountries",
        mi.original_language as "originalLanguage",
        mi.content_class as "contentClass",
        mi.rating_imdb as "ratingImdb",
        mi.rating_metacritic as "ratingMetacritic",
        mi.rating_rotten_tomatoes as "ratingRottenTomatoes",
        mi.rating_trakt as "ratingTrakt",
        mi.vote_count_imdb as "voteCountImdb",
        mi.vote_count_trakt as "voteCountTrakt",
        ms.quality_score as "qualityScore",
        ms.popularity_score as "popularityScore",
        ms.freshness_score as "freshnessScore",
        ms.ratingo_score as "ratingoScore"
      FROM media_items mi TABLESAMPLE BERNOULLI(${samplePercent})
      LEFT JOIN media_stats ms ON mi.id = ms.media_item_id
      WHERE mi.deleted_at IS NULL
        AND mi.ingestion_status = 'ready'
      LIMIT ${limit}
    `);

    return result as unknown as DryRunMediaItem[];
  }

  async fetchTopItems(limit: number): Promise<DryRunMediaItem[]> {
    const result = await this.db
      .select(DRY_RUN_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(isNull(schema.mediaItems.deletedAt), eq(schema.mediaItems.ingestionStatus, 'ready')),
      )
      .orderBy(sql`${schema.mediaStats.popularityScore} DESC NULLS LAST`)
      .limit(limit);

    return result as DryRunMediaItem[];
  }

  async fetchByTypeItems(mediaType: MediaType, limit: number): Promise<DryRunMediaItem[]> {
    const result = await this.db
      .select(DRY_RUN_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(
          isNull(schema.mediaItems.deletedAt),
          eq(schema.mediaItems.ingestionStatus, 'ready'),
          eq(schema.mediaItems.type, mediaType),
        ),
      )
      .orderBy(sql`${schema.mediaStats.popularityScore} DESC NULLS LAST`)
      .limit(limit);

    return result as DryRunMediaItem[];
  }

  async fetchByCountryItems(country: string, limit: number): Promise<DryRunMediaItem[]> {
    const countryUpper = country.toUpperCase();

    const result = await this.db
      .select(DRY_RUN_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(
          isNull(schema.mediaItems.deletedAt),
          eq(schema.mediaItems.ingestionStatus, 'ready'),
          sql`${schema.mediaItems.originCountries} @> ${JSON.stringify([countryUpper])}::jsonb`,
        ),
      )
      .orderBy(sql`${schema.mediaStats.popularityScore} DESC NULLS LAST`)
      .limit(limit);

    return result as DryRunMediaItem[];
  }

  async getCurrentEvaluations(mediaItemIds: string[]): Promise<Map<string, CurrentEvaluation>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    const map = new Map<string, CurrentEvaluation>();

    // Process in batches to avoid large IN clauses
    for (let i = 0; i < mediaItemIds.length; i += EVALUATION_BATCH_SIZE) {
      const batch = mediaItemIds.slice(i, i + EVALUATION_BATCH_SIZE);
      const result = await this.db
        .select({
          mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
          status: schema.mediaCatalogEvaluations.status,
        })
        .from(schema.mediaCatalogEvaluations)
        .where(inArray(schema.mediaCatalogEvaluations.mediaItemId, batch));

      for (const row of result) {
        map.set(row.mediaItemId, { mediaItemId: row.mediaItemId, status: row.status });
      }
    }

    return map;
  }
}
