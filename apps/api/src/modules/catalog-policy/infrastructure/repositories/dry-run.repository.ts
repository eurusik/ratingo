/**
 * Dry-Run Repository
 *
 * Database queries for dry-run evaluation.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';

import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { DEFAULT_EVALUATION_CONTEXT } from '@/modules/catalog-policy/domain/constants/evaluation.constants';
import {
  type IDryRunRepository,
  type CurrentEvaluation,
} from '@/modules/catalog-policy/domain/repositories/dry-run.repository.interface';
import { type PolicyEngineInput } from '@/modules/catalog-policy/domain/types/policy.types';
import {
  type IMediaWatchOffersRepository,
  MEDIA_WATCH_OFFERS_REPOSITORY,
} from '@/modules/provider/public';

import { mapOffersByMediaItemToNormalized } from '../mappers/offer.mapper';
import { type MediaItemRow, mapRowsToPolicyEngineInputs } from '../mappers/policy-input.mapper';

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
  watchersCount: schema.mediaStats.watchersCount,
};

@Injectable()
export class DryRunRepository implements IDryRunRepository {
  private readonly logger = new Logger(DryRunRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(MEDIA_WATCH_OFFERS_REPOSITORY)
    private readonly watchOffersRepository: IMediaWatchOffersRepository,
  ) {}

  async fetchSampleItems(limit: number, samplePercent: number): Promise<PolicyEngineInput[]> {
    const result = await withDbError('fetch dry-run sample items', this.logger, () =>
      this.db.execute(sql`
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
        ms.ratingo_score as "ratingoScore",
        ms.watchers_count as "watchersCount"
      FROM media_items mi TABLESAMPLE BERNOULLI(${samplePercent})
      LEFT JOIN media_stats ms ON mi.id = ms.media_item_id
      WHERE mi.deleted_at IS NULL
        AND mi.ingestion_status = 'ready'
      LIMIT ${limit}
    `),
    );

    return this.toPolicyEngineInputs(result as unknown as MediaItemRow[]);
  }

  async fetchTopItems(limit: number): Promise<PolicyEngineInput[]> {
    const result = await withDbError('fetch dry-run top items', this.logger, () =>
      this.db
        .select(DRY_RUN_SELECT_FIELDS)
        .from(schema.mediaItems)
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(
          and(isNull(schema.mediaItems.deletedAt), eq(schema.mediaItems.ingestionStatus, 'ready')),
        )
        .orderBy(sql`${schema.mediaStats.popularityScore} DESC NULLS LAST`)
        .limit(limit),
    );

    return this.toPolicyEngineInputs(result);
  }

  async fetchByTypeItems(mediaType: MediaType, limit: number): Promise<PolicyEngineInput[]> {
    const result = await withDbError('fetch dry-run items by type', this.logger, () =>
      this.db
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
        .limit(limit),
    );

    return this.toPolicyEngineInputs(result);
  }

  async fetchByCountryItems(country: string, limit: number): Promise<PolicyEngineInput[]> {
    const countryUpper = country.toUpperCase();

    const result = await withDbError('fetch dry-run items by country', this.logger, () =>
      this.db
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
        .limit(limit),
    );

    return this.toPolicyEngineInputs(result);
  }

  async getCurrentEvaluations(mediaItemIds: string[]): Promise<Map<string, CurrentEvaluation>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    const map = new Map<string, CurrentEvaluation>();

    // Process in batches to avoid large IN clauses
    for (let i = 0; i < mediaItemIds.length; i += EVALUATION_BATCH_SIZE) {
      const batch = mediaItemIds.slice(i, i + EVALUATION_BATCH_SIZE);
      const result = await withDbError('fetch dry-run current evaluations', this.logger, () =>
        this.db
          .select({
            mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
            status: schema.mediaCatalogEvaluations.status,
          })
          .from(schema.mediaCatalogEvaluations)
          .where(
            and(
              inArray(schema.mediaCatalogEvaluations.mediaItemId, batch),
              // Only the currently active policy version in the catalog context is the baseline;
              // otherwise historical versions / other contexts overwrite each other in the map.
              eq(schema.mediaCatalogEvaluations.context, DEFAULT_EVALUATION_CONTEXT),
              eq(
                schema.mediaCatalogEvaluations.policyVersion,
                sql`(SELECT ${schema.catalogPolicies.version} FROM ${schema.catalogPolicies} WHERE ${schema.catalogPolicies.isActive} = true LIMIT 1)`,
              ),
            ),
          ),
      );

      for (const row of result) {
        map.set(row.mediaItemId, { mediaItemId: row.mediaItemId, status: row.status });
      }
    }

    return map;
  }

  private async toPolicyEngineInputs(rows: MediaItemRow[]): Promise<PolicyEngineInput[]> {
    if (rows.length === 0) {
      return [];
    }

    const mediaItemIds = rows.map((row) => row.id);
    const offersByMediaItem = await withDbError(
      'fetch watch offers for dry-run',
      this.logger,
      () =>
        this.watchOffersRepository.getOffersForMediaBatch(mediaItemIds, {
          includeVariantInfo: true,
        }),
      { count: mediaItemIds.length },
    );

    return mapRowsToPolicyEngineInputs(
      rows,
      mapOffersByMediaItemToNormalized(offersByMediaItem),
      this.logger,
    );
  }
}
